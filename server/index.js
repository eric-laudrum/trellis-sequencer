const express = require('express');
const multer = require('multer');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { RoomStore } = require('./RoomStore');
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
        resource_type: 'auto'
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 30 * 1024 * 1024 }
});


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

// In-memory room state and access control
const roomStore = new RoomStore();

// Socket IO logic
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const broadcastRoomList = () => io.emit('room-list', roomStore.getListedRooms());
const reply = (callback, payload) => {
    if (typeof callback === 'function') callback(payload);
};

const sendRoomAccess = (room) => {
    for (const memberId of room.members) {
        io.to(memberId).emit('room-access-updated', {
            room: roomStore.serializeRoom(room, memberId),
        });
    }
};

const sendPendingRequests = (room) => {
    if (!room.hostId) return;
    for (const request of room.pendingRequests.values()) {
        io.to(room.hostId).emit('join-request', request);
    }
};

const cancelPendingRequests = (socket, code) => {
    for (const { room, request } of roomStore.cancelPending(socket.id, code)) {
        if (room.hostId) {
            io.to(room.hostId).emit('join-request-resolved', { requestId: request.id });
        }
    }
};

const leaveCurrentRoom = (socket) => {
    if (!socket.currentRoom) return;
    const result = roomStore.leave(socket.currentRoom, socket.id);
    socket.leave(socket.currentRoom);
    socket.currentRoom = null;

    if (result) {
        for (const request of result.deniedRequests) {
            io.to(request.id).emit('join-denied', {
                roomId: result.room.id,
                message: 'The room host left before responding to your request.',
            });
        }
        if (result.previousHostId !== result.newHostId) {
            sendRoomAccess(result.room);
            sendPendingRequests(result.room);
        }
        broadcastRoomList();
    }
};

const enterRoom = (socket, room) => {
    socket.join(room.id);
    socket.currentRoom = room.id;
};

const isMemberOf = (socket, roomId) => (
    socket.currentRoom === roomId && socket.rooms.has(roomId) && roomStore.getRoom(roomId)
);

io.on('connection', (socket) => {
    console.log('User connected: ' + socket.id);

    socket.emit('room-list', roomStore.getListedRooms());

    socket.on('get-rooms', () => {
        socket.emit('room-list', roomStore.getListedRooms());
    });

    socket.on('create-room', (data, callback) => {
        const result = roomStore.createRoom({
            name: data?.name,
            access: data?.access,
            hostId: socket.id,
        });
        if (result.error) return reply(callback, { status: 'error', message: result.error });

        cancelPendingRequests(socket);
        leaveCurrentRoom(socket);
        enterRoom(socket, result.room);
        broadcastRoomList();
        reply(callback, {
            status: 'joined',
            room: roomStore.serializeRoom(result.room, socket.id),
        });
    });

    socket.on('join-room', (data, callback) => {
        const code = typeof data === 'string' ? data : data?.code;
        cancelPendingRequests(socket);
        const result = roomStore.requestJoin(code, socket.id, data?.guestName);
        if (result.error) return reply(callback, { status: 'error', message: result.error });

        if (result.status === 'joined' && socket.currentRoom === result.room.id) {
            return reply(callback, {
                status: 'joined',
                room: roomStore.serializeRoom(result.room, socket.id),
            });
        }

        leaveCurrentRoom(socket);
        if (result.status === 'pending') {
            io.to(result.room.hostId).emit('join-request', result.request);
            return reply(callback, {
                status: 'pending',
                room: roomStore.serializeRoom(result.room, socket.id),
            });
        }

        enterRoom(socket, result.room);
        broadcastRoomList();
        reply(callback, {
            status: 'joined',
            room: roomStore.serializeRoom(result.room, socket.id),
        });
    });

    socket.on('cancel-join', (code) => cancelPendingRequests(socket, code));

    socket.on('get-initial-state', (roomId) => {
        const room = isMemberOf(socket, roomId);
        if (!room) return;
        socket.emit('initial-state', {
            grid: room.grid,
            bpm: room.bpm,
            samples: room.samples,
            numBars: room.numBars,
        });
    });

    socket.on('update-room-access', ({ roomId, access }, callback) => {
        const result = roomStore.updateAccess(socket.id, roomId, access);
        if (result.error) return reply(callback, { status: 'error', message: result.error });

        for (const request of result.deniedRequests) {
            socket.emit('join-request-resolved', { requestId: request.id });
            io.to(request.id).emit('join-denied', {
                roomId: roomId,
                message: 'The host stopped accepting join requests.',
            });
        }
        sendRoomAccess(result.room);
        broadcastRoomList();
        reply(callback, { status: 'updated', room: roomStore.serializeRoom(result.room, socket.id) });
    });

    socket.on('respond-to-join', ({ roomId, requestId, approved }, callback) => {
        if (approved && !io.sockets.sockets.has(requestId)) {
            roomStore.respondToJoin(socket.id, roomId, requestId, false);
            socket.emit('join-request-resolved', { requestId });
            return reply(callback, { status: 'error', message: 'This guest has disconnected.' });
        }

        const result = roomStore.respondToJoin(socket.id, roomId, requestId, approved);
        if (result.error) return reply(callback, { status: 'error', message: result.error });

        socket.emit('join-request-resolved', { requestId });
        if (!approved) {
            io.to(requestId).emit('join-denied', {
                roomId,
                message: 'The host denied your request to join this room.',
            });
            return reply(callback, { status: 'denied' });
        }

        const guestSocket = io.sockets.sockets.get(requestId);
        enterRoom(guestSocket, result.room);
        guestSocket.emit('join-approved', {
            room: roomStore.serializeRoom(result.room, requestId),
        });
        broadcastRoomList();
        reply(callback, { status: 'approved' });
    });

    socket.on('leave-room', () => leaveCurrentRoom(socket));

    socket.on('pad-toggle', ({ index, newState }) => {
        const roomId = socket.currentRoom;
        const room = isMemberOf(socket, roomId);
        if (room && Number.isInteger(index) && index >= 0 && index < room.grid.length) {
            room.grid[index] = newState;
            socket.to(roomId).emit('update-state', { index, newState });
        }
    });

    socket.on('delete-sample', (sampleId) => {
        const roomId = socket.currentRoom;
        const room = isMemberOf(socket, roomId);
        if (room) {
            room.samples = room.samples.filter(s => s.id !== sampleId);
            socket.to(roomId).emit('remove-sample', sampleId);
        }
    });

    socket.on('transport-toggle', ({ isPlaying }) => {
        if (isMemberOf(socket, socket.currentRoom)) {
            socket.to(socket.currentRoom).emit('update-transport', { isPlaying });
        }
    });

    socket.on('bpm-change', (newBpm) => {
        const roomId = socket.currentRoom;
        const room = isMemberOf(socket, roomId);
        if (room) {
            room.bpm = newBpm;
            socket.to(roomId).emit('update-bpm', newBpm);
        }
    });

    socket.on('share-sample', ({ roomId, sampleData }) => {
        const room = isMemberOf(socket, roomId);
        if (!room || !sampleData) return;
        room.samples.push(sampleData);
        socket.to(roomId).emit('download-sample', sampleData);
    });

    socket.on('update-sample-bounds', (data) => {
        const { roomId, sampleId, startTime, endTime } = data;
        const room = isMemberOf(socket, roomId);
        if (!room) return;

        const sample = room.samples.find(s => s.id === sampleId);
        if (sample) {
            if (startTime !== undefined) sample.startTime = startTime;
            if (endTime !== undefined) sample.endTime = endTime;
        }
        socket.to(roomId).emit('update-sample-bounds', data);
    });

    socket.on('update-sample-volume', (data) => {
        const { roomId, sampleIds, volume } = data;
        const room = isMemberOf(socket, roomId);
        if (!room || !Array.isArray(sampleIds)) return;

        sampleIds.forEach(id => {
            const sample = room.samples.find(s => s.id === id);
            if (sample) sample.volume = volume;
        });
        socket.to(roomId).emit('update-sample-volume', data);
    });

    socket.on('update-sample-color', (data) => {
        const { roomId, sampleId, color } = data;
        const room = isMemberOf(socket, roomId);
        if (!room) return;

        const sample = room.samples.find(s => s.id === sampleId);
        if (sample) sample.color = color;
        socket.to(roomId).emit('update-sample-color', data);
    });

    socket.on('stop-all-audio', (data) => {
        const roomId = data?.roomId;
        if (isMemberOf(socket, roomId)) io.to(roomId).emit('sync-stop');
    });

    socket.on('update-entire-grid', ({ roomId, grid, numBars }) => {
        const room = isMemberOf(socket, roomId);
        if (room) {
            room.grid = grid;
            room.numBars = numBars;
            socket.to(roomId).emit('sync-entire-grid', { grid, numBars });
        }
    });

    socket.on('send-message', (data) => {
        const roomId = socket.currentRoom;
        if (isMemberOf(socket, roomId)) socket.to(roomId).emit('chat-message', data);
    });

    socket.on('disconnect', () => {
        cancelPendingRequests(socket);
        leaveCurrentRoom(socket);
        broadcastRoomList();
    });
});

// Health check
app.get('/', (req, res) => {
    res.send('Trellis Backend is running.');
});


// Render dynamic port
const PORT = process.env.PORT || 4000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});