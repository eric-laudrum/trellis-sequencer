import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
const lobbySocket = io('http://localhost:4000');

export default function Lobby({onJoin }){
    const [ rooms, setRooms ] = useState([]);
    const [ input, setInput ] = useState('');

    useEffect(() =>{
        lobbySocket.emit('get-rooms');
        lobbySocket.on('room-list', (list) => {
            setRooms(list)
        });

        return () => lobbySocket.off('room-list');

    }, []);



    return(
        <div className="landing-page">
            <h1>TRELLIS STUDIO</h1>
            <h3>LOBBY</h3>
            <div className="create-section">
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Room name..."
                    />
                <button onClick={() => input && onJoin(input)}>CREATE / JOIN</button>
            </div>
            <div className="room-list">
                <h3>Rooms</h3>
                {rooms.length === 0 && <p className="empty-msg">No active studios. Start one!</p>}

                {rooms.map(room => (
                    <div key={room.name} className="room-item">
                        <div className="room-info">
                            <span className="room-name">{room.name}</span>
                            <span className="room-count">{room.count} {room.count === 1 ? 'Person' : 'People'} Jamming</span>
                        </div>
                        <button className="join-btn" onClick={() => onJoin(room.name)}>JOIN</button>
                    </div>
                ))}
            </div>
        </div>
    );
}