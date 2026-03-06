import React, { useState } from 'react'
import io from 'socket.io-client';
import Lobby from "./components/Lobby.jsx";

import './App.css'
import StudioRoom from "./components/StudioRoom.jsx";

const SOCKET_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:4000'
    : window.location.origin;

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

    // Start in the Lobby
    if(!roomName){
        return <Lobby onJoin={(name) => setRoomName(name)}/>;
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