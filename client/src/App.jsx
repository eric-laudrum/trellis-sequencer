import React, { useState } from 'react'
import io from 'socket.io-client';


import TrellisGrid from './components/TrellisGrid.jsx';
import SampleSidebar from "./components/SampleSidebar.jsx";
import WaveformEditor from "./components/WaveformEditor.jsx";
import Lobby from "./components/Lobby.jsx";

import './App.css'
import StudioRoom from "./components/StudioRoom.jsx";

const socket = io();

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