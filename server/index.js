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

io.on('connection', (socket) => {
    console.log('Socket connection connected: ' + socket.id);

    socket.on('disconnect', ()=>{
        console.log('Socket disconnected');
    });
});

server.listen(4000, () =>{
    console.log('Server started on port 4000');
});

