const socket = io.connect('https://192.168.1.182:3000');
let localStream, remoteStream, peerConnection;
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

socket.emit('handshake', generateRandomUsername());

socket.on('ShowAvailableOffers', (offerObjects) => {
    offerObjects.forEach(createAnswerButton);
});

socket.on('NewOffer', createAnswerButton);

socket.on('NewAnswer', (answer) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('receiveICECandidate', (candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

function generateRandomUsername() {
    return 'User' + Math.floor(Math.random() * 10000);
}

function createAnswerButton(offerObject) {
    const button = document.createElement('button');
    button.textContent = `Answer ${offerObject.offerer_username}`;
    button.onclick = () => answerOffer(offerObject);
    document.getElementById('offers').appendChild(button);
}

async function call() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
    
    remoteStream = new MediaStream();
    document.getElementById('remoteVideo').srcObject = remoteStream;

    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.addEventListener('track', (event) => {
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
    });
    
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    peerConnection.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
            socket.emit('sendServerICEcandidate', event.candidate, true, socket.id);
        }
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('NewOffer', offer);
}

async function answerOffer(offerObject) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
    
    remoteStream = new MediaStream();
    document.getElementById('remoteVideo').srcObject = remoteStream;

    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.addEventListener('track', (event) => {
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
    });

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    peerConnection.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
            socket.emit('sendServerICEcandidate', event.candidate, false, offerObject.offerer);
        }
    });

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offerObject.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    offerObject.answer = answer;
    offerObject.answerer = socket.id;
    socket.emit('NewAnswer', offerObject, (ICE_buffer) => {
        ICE_buffer.forEach(candidate => peerConnection.addIceCandidate(new RTCIceCandidate(candidate)));
    });
}

