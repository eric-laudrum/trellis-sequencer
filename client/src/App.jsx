import React, { useState } from 'react'
import io from 'socket.io-client';
import * as Tone from 'tone'; // <-- Ensure Tone is imported here
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
    const handleJoin = async (name) => {

        // PROPER TONE.JS AUDIO UNLOCK
        try {
            await Tone.start();
            console.log("[AUDIO] Tone.js Context unlocked by user gesture!");
        } catch (err) {
            console.error("[AUDIO] Failed to start Tone context", err);
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