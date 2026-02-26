const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors:{
        origin: ["http://localhost:5173", "http://localhost:3000"], // backup in case ports shift
        methods: ["GET", "POST"]
    }
});
const Y = require('yjs');

// Master Lattice
const ydoc = new Y.Doc();
const yArray = ydoc.getArray('trellis-grid');

// Initialize 16 Grid of 0
if(yArray.length === 0){
    yArray.insert(0, new Array(16).fill(false));
}

io.on('connection', (socket) => {
    console.log('Socket connection connected: ' + socket.id);

    socket.emit('initial-state', yArray.toArray());

    // Listen for a pad-toggle
    socket.on('pad-toggle', ({ index, newState }) =>{
        yArray.delete(index, 1);
        yArray.insert(index, [newState]);
    })

    // Broadcast the change
    socket.broadcast.emit('state-update', {index, newState });

    // Disconnect
    socket.on('disconnect', ()=>{
        console.log('Socket disconnected');
    });
});

server.listen(4000, () =>{
    console.log('Server started on port 4000');
});

