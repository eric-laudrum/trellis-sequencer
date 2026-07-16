const express = require('express');
const multer = require('multer');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const authRoute = require('./routes/authRoutes');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'trellis-sequencer/users',
        resource_type: 'auto',
        allowed_formats: ['mp3', 'wav', 'ogg', 'm4a']
    },
});

const upload = multer({ storage: storage });

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Could not connect to MongoDB:', err));

// App Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

// Serve static frontend files (if building React into 'client/dist')
app.use(express.static(path.join(__dirname, '../client/dist')));

// API Routes
app.use('/api/user', authRoute);

app.post('/upload-sample', upload.single('file'), (req, res) => {
    if (!req.file) {
        console.error("Upload Failed: No file in request");
        return res.status(400).json({ error: 'No file uploaded' });
    }
    console.log(`[FILE] Successfully uploaded to Cloudinary: ${req.file.originalname}`);
    res.json({
        url: req.file.path,
        name: req.file.originalname
    });
});

// Data storage for rooms
const rooms = {};

// Socket IO logic
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const getRoomListData = () => {
    return Object.keys(rooms).map(roomName => {
        const activeSocketRoom = io.sockets.adapter.rooms.get(roomName);
        return {
            name: roomName,
            count: activeSocketRoom ? activeSocketRoom.size : 0
        };
    });
};

io.on('connection', (socket) => {
    console.log('User connected: ' + socket.id);

    socket.emit('room-list', getRoomListData());

    socket.on('get-rooms', () =>{
        socket.emit('room-list', getRoomListData());
    });

    socket.on('join-room', (roomName) => {
        socket.join(roomName);
        socket.currentRoom = roomName;

        if (!rooms[roomName]) {
            rooms[roomName] = {
                grid: Array.from({ length: 16 }, () => ({ isActive: false, sampleId: null })),
                bpm: 120,
                samples: [],
                numBars: 1,
            };
        }

        socket.emit('initial-state', {
            grid: rooms[roomName].grid,
            bpm: rooms[roomName].bpm,
            samples: rooms[roomName].samples,
            numBars: rooms[roomName].numBars,
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
        if (rooms[roomId]) {
            rooms[roomId].samples.push(sampleData);
        }
        socket.to(roomId).emit('download-sample', sampleData);
    });

    socket.on('stop-all-audio', (data) => {
        const room = data?.roomId;
        if (room) {
            io.to(room).emit('sync-stop');
        }
    });

    socket.on('update-entire-grid', ({ roomId, grid, numBars }) => {
        if (rooms[roomId]) {
            rooms[roomId].grid = grid;
            rooms[roomId].numBars = numBars;
            socket.to(roomId).emit('sync-entire-grid', { grid, numBars });
        }
    });

    socket.on('send-message', (data) => {
        const room = socket.currentRoom;
        if( room ){
            socket.to(room).emit('chat-message', data);
        }
    });

    socket.on('disconnect', () => {
        io.emit('room-list', getRoomListData());
    });
});

app.get('(.*)', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});

// Render dynamic port
const PORT = process.env.PORT || 4000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});