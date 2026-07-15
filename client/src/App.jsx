import React, { useState } from 'react';
import io from 'socket.io-client';
import * as Tone from 'tone';
import Lobby from "./components/Lobby.jsx";
import StudioRoom from "./components/StudioRoom.jsx";
import AuthModal from "./components/AuthModal.jsx";
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const socket = io(BACKEND_URL, {
    extraHeaders: {
        "ngrok-skip-browser-warning": "true"
    },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    timeout: 10000
});

function App() {
    const [roomName, setRoomName] = useState(null);
    const [user, setUser] = useState(null);
    const [showAuthModal, setShowAuthModal] = useState(false);

    const handleJoin = async (name) => {
        try {
            await Tone.start();
        } catch (err) {
            console.error("Audio context initialization failed.", err);
        }

        socket.emit('join-room', name);
        setRoomName(name);
    };

    const handleLogout = () => {
        localStorage.removeItem('trellis_token');
        setUser(null);
    };

    return (
        <div className="app-root">
            <header style={{ position: 'absolute', top: 10, right: 10, zIndex: 100 }}>
                {user ? (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ color: '#aaa', fontSize: '12px' }}>{user.email}</span>
                        <button onClick={handleLogout} className="settings-btn">Logout</button>
                    </div>
                ) : (
                    <button onClick={() => setShowAuthModal(true)} className="settings-btn">Login / Sign Up</button>
                )}
            </header>

            {showAuthModal && (
                <AuthModal
                    onLoginSuccess={(userData) => {
                        setUser(userData);
                        setShowAuthModal(false);
                    }}
                    onClose={() => setShowAuthModal(false)}
                    backendUrl={BACKEND_URL}
                />
            )}

            {!roomName ? (
                <Lobby socket={socket} onJoin={handleJoin} />
            ) : (
                <StudioRoom
                    roomName={roomName}
                    socket={socket}
                    onLeave={() => setRoomName(null)}
                    user={user}
                />
            )}
        </div>
    );
}

export default App;