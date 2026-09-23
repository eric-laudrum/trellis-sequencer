import React, { useState } from 'react';
import io from 'socket.io-client';
import * as Tone from 'tone';
import Lobby from "./components/Lobby.jsx";
import StudioRoom from "./components/StudioRoom.jsx";
import AuthModal from "./components/AuthModal.jsx";
import './App.css';
import HomePage from "./pages/HomePage.jsx";
import AccountStatus from "./components/AccountStatus.jsx";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
console.log("Vite injected URL:", import.meta.env.VITE_BACKEND_URL);
console.log("Socket is trying to connect to:", BACKEND_URL);


const socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    timeout: 10000
});

function App() {
    const [roomName, setRoomName] = useState(null);
    const [user, setUser] = useState(null);
    const [view, setView] = useState('home');

    const handleJoin = async (name) => {
        try {
            await Tone.start();
        } catch (err) {
            console.error("Audio context initialization failed.", err);
        }

        socket.emit('join-room', name);

        setRoomName(name);
        setView('studio');
    };

    const handleLeave = () => {
        if(roomName) {
            socket.emit('leave-room', roomName);
        }
        setRoomName(null);
        setView('lobby');
    };


    return (
        <div className="app-root">

            <AccountStatus />

            {view === 'home' && (
                <HomePage onEnterLobby={() => {
                    console.log('-- go to lobby -- ');
                    setView('lobby')

                }}
                />
            )}

            {view === 'lobby' && (
                <Lobby socket={socket} onJoin={handleJoin} />
            )}

            {view === 'studio' && (
                <StudioRoom
                    roomName={roomName}
                    socket={socket}
                    onLeave={handleLeave}
                    user={user}
                />
            )}
        </div>
    );
}

export default App;