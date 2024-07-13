const fs = require('fs');
const https = require('https');
const express = require('express');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = https.createServer({
    key: fs.readFileSync(path.join(__dirname, 'cert.key')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.crt'))
}, app);

const io = socketIO(server);

const clients = [];
const offers = [];

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    socket.on('handshake', (username) => {
        clients.push({ socketID: socket.id, username });
        socket.emit('ShowAvailableOffers', offers);
    });

    socket.on('NewOffer', (offer) => {
        const client = clients.find(c => c.socketID === socket.id);
        if (client) {
            const offerObject = {
                offerer: socket.id,
                offerer_username: client.username,
                offer: offer, // Assigning the offer SDP
                answerer: null,
                answer: null,
                ICE_buffer: []
            };
            offers.push(offerObject);
            socket.broadcast.emit('NewOffer', offerObject);
        }
    });

    socket.on('NewAnswer', (offerObject, ack) => {
        const originalOffer = offers.find(o => o.offerer === offerObject.offerer);
        if (originalOffer) {
            originalOffer.answerer = offerObject.answerer;
            originalOffer.answer = offerObject.answer;
            ack(originalOffer.ICE_buffer);
            offers.splice(offers.indexOf(originalOffer), 1);
            io.to(originalOffer.offerer).emit('NewAnswer', originalOffer.answer);
        }
    });

    socket.on('sendServerICEcandidate', (candidate, didIOffer, socketID) => {
        const offerObject = offers.find(o => o.offerer === socketID);
        if (offerObject) {
            if (didIOffer) {
                if (offerObject.answerer) {
                    io.to(offerObject.answerer).emit('receiveICECandidate', candidate);
                } else {
                    offerObject.ICE_buffer.push(candidate);
                }
            } else {
                io.to(offerObject.offerer).emit('receiveICECandidate', candidate);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        const index = clients.findIndex(client => client.socketID === socket.id);
        if (index !== -1) clients.splice(index, 1);
        const offerIndex = offers.findIndex(offer => offer.offerer === socket.id || offer.answerer === socket.id);
        if (offerIndex !== -1) offers.splice(offerIndex, 1);
    });
});

server.listen(3000, () => {
    console.log('Server is running on https://localhost:3000');
});
