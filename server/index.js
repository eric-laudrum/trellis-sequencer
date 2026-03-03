const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Data storage
const rooms = {};

// File upload
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: 'uploads/' });

// Api routes
app.post('/upload-sample', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    console.log("File uploaded, URL created:", fileUrl);
    res.json({ url: fileUrl, name: req.file.originalname });
});

// Socket IO logic
const io = new Server(server, {
    cors: {
        origin: "*", // Allow connection from any ngrok/localhost source for testing
        methods: ["GET", "POST"]
    }
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
    console.log('User connected: ' + socket.id);

    socket.on('get-rooms', () =>{
        socket.emit('room-list', getRoomListData());
    });

    socket.on('join-room', (roomName) => {
        socket.join(roomName);
        socket.currentRoom = roomName;

        if (!rooms[roomName]) {
            rooms[roomName] = {
                grid: Array.from({ length: 16 }, () => ({ isActive: false, sampleId: null })),
                bpm: 120
            };
        }

        // Send room state and bpm to the new user
        socket.emit('initial-state', {
            grid: rooms[roomName].grid,
            bpm: rooms[roomName].bpm
        });

        io.emit('room-list', getRoomListData());
    });

    socket.on('pad-toggle', ({ index, newState }) => {
        const room = socket.currentRoom;
        if (room && rooms[room]) {
            rooms[room].grid[index] = newState;
            socket.to(room).emit('update-state', { index, newState });
        }
    });

    socket.on('transport-toggle', ({ isPlaying }) => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('update-transport', { isPlaying });
        }
    });

    socket.on('bpm-change', (newBpm) => {
        const room = socket.currentRoom;
        if (room && rooms[room]) {
            rooms[room].bpm = newBpm;
            socket.to(room).emit('update-bpm', newBpm);
        }
    });

    socket.on('share-sample', ({ roomId, sampleData }) => {
        socket.to(roomId).emit('download-sample', sampleData);
    });

    socket.on('disconnect', () => {
        io.emit('room-list', getRoomListData());
    });
});

const cleanOldFiles = () => {
    fs.readdir(uploadDir, (err, files) => {
        files.forEach(file => {
            const filePath = path.join(uploadDir, file);
            const stats = fs.statSync(filePath);
            if (Date.now() - stats.mtimeMs > 24 * 60 * 60 * 1000) {
                fs.unlinkSync(filePath);
            }
        });
    });
};
setInterval(cleanOldFiles, 3600000);

// Catch all
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});




server.listen(4000, () =>{
    console.log('Server started on port 4000');
});

