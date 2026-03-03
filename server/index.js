const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const rooms = {};

const io = new Server(server, {
    cors:{
        origin: [
            "http://localhost:5173",
            "https://stella-nonexpectant-nondeficiently.ngrok-free.dev",
            "http://localhost:3000"

        ], // backup in case ports shift
        methods: ["GET", "POST"]
    }
});

const path = require('path');
app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const getRoomListData = () =>{
    return Object.keys(rooms).map(roomName =>{
        const room = io.sockets.adapter.rooms.get(roomName);
        return {
            name: roomName,
            count: room ? room.size: 0
        };
    });
}

io.on('connection', (socket) => {
    console.log('Socket connection connected: ' + socket.id);

    socket.on('get-rooms', () =>{
        socket.emit('room-list', getRoomListData());
    });

    socket.on('transport-toggle', ({ isPlaying }) => {
        const room = socket.currentRoom;
        if (room) {
            // Broadcast to everyone ELSE in the room
            socket.to(room).emit('update-transport', { isPlaying });
        }
    });

    socket.on('bpm-change', (newBpm) => {
        const room = socket.currentRoom;
        if (room && rooms[room]) {
            rooms[room].bpm = newBpm;
            socket.to(room).emit('update-bpm', newBpm);
        }
    });

    // socket.emit('initial-state', yArray.toArray());
    socket.on('join-room', (roomName) =>{
        socket.join(roomName);
        socket.currentRoom = roomName; // tag socket

        if( !rooms[roomName]){
            rooms[ roomName ] = {
                grid: Array.from({length: 16}, () =>({isActive: false, sampleId: null}))

            };
        }

        // Send room state to user
        socket.emit('initial-state', rooms[roomName].grid);

        // Update lobby for everyone
        io.emit('room-list', getRoomListData());

        console.log(`Socket ${socket.id} joined ${roomName}`);
    });

    // Handle pad-toggle in selected room
    socket.on('pad-toggle', ({ index, newState }) =>{
        const room = socket.currentRoom;
        if( room && rooms[room]){

            rooms[room].grid[index] = newState;

            // Broadcast change to the room
            socket.to(room).emit('update-state',  { index, newState });
        }
    });

    // Disconnect
    socket.on('disconnect', ()=>{
        io.emit('room-list', getRoomListData());
        console.log('User disconnected ' + socket.id);
    });
});

server.listen(4000, () =>{
    console.log('Server started on port 4000');
});

