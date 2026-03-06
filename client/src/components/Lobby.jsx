import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

export default function Lobby({socket, onJoin }){
    const [ rooms, setRooms ] = useState([]);
    const [ input, setInput ] = useState('');

    useEffect(() =>{
        if(!socket) return;

        // Use socket from App.js
        const onConnect = () => {
            socket.emit('get-rooms');
        };

        if (socket.connected) {
            onConnect();
        }

        socket.on('connect', onConnect);
        socket.on('room-list', (list) => setRooms(list));


        return () => {
            socket.off('connect', onConnect);
            socket.off('room-list');
        };

    }, [socket]);


    return(
        <div className="landing-page">
            <h1>TRELLIS STUDIO</h1>
            <h3>LOBBY</h3>
            <div className="create-section">

                {/* Debugging */}
                <p style={{color: socket?.connected ? 'green' : 'red', fontSize: '10px'}}>
                    {socket?.connected ? '● Server Connected' : '○ Connecting to Server...'}
                </p>

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