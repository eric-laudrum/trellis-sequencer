import React, { useState } from 'react'
import io from 'socket.io-client';
import Lobby from "./components/Lobby.jsx";

import './App.css'
import StudioRoom from "./components/StudioRoom.jsx";

const NGROK_BACKEND = "https://stella-nonexpectant-nondeficiently.ngrok-free.dev";

// Logic to switch between local and tunnel
const SOCKET_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:4000'
    : NGROK_BACKEND;

// Initialize transponders
const socket = io(SOCKET_URL, {
    extraHeaders: {
        "ngrok-skip-browser-warning": "true"
    },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    timeout: 10000
});

function App() {
    const [ roomName, setRoomName ] = useState(null);


    // Broadcast join
    const handleJoin = (name) => {
        // Resume Audio
        if (window.AudioContext || window.webkitAudioContext) {
            const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
            tempCtx.resume();
        }

        // Existing socket/state logic
        socket.emit('join-room', name);
        setRoomName(name);
    };

    // Start in the Lobby
    if(!roomName){
        return <Lobby socket={socket} onJoin={handleJoin}/>;
    }

    return (
        <StudioRoom
            roomName={roomName}
            socket={socket}
            onLeave={() => setRoomName(null)}
        />

    );
}

export default App;