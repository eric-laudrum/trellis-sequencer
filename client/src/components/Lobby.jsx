import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

import '../styles/Lobby.css';

export default function Lobby({socket, onJoin }){
    const [ rooms, setRooms ] = useState([]);
    const [ input, setInput ] = useState('');
    const [ isConnected, setIsConnected ] = useState(socket?.connected || false);


    useEffect(() =>{
        if(!socket) return;

        // Use socket from App.js
        const onConnect = () => {
            setIsConnected(true);
            socket.emit('get-rooms');
        };

        const onDisconnect = () => {
            setIsConnected(false);
        };

        const onRoomList = (list) => {
            console.log("[Lobby] Received room list update:", list);
            setRooms(list);
        };

        if (socket.connected) {
            onConnect();
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('room-list', onRoomList);


        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('room-list');
        };

    }, [socket]);


    return(
        <div className="lobby">
            <h1>TRELLIS STUDIO</h1>
            <h3>LOBBY</h3>
            <div className="create-section">

                {/* Connection Message */}
                <p style={{color: socket?.connected ? 'green' : 'red', fontSize: '10px'}}>
                    {socket?.connected ? '● Server Connected' : '○ Connecting to Server...'}
                </p>

                {/* Create Room */}
                <input
                    className={'room-name-input'}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Room name..."
                />
                <button
                    className={'create-button'}
                    onClick={() => input && onJoin(input)}
                >
                    create
                </button>
            </div>

            {/* List of Rooms */}
            <div className="room-list">
                <h3>Rooms</h3>
                {rooms.length === 0 && <p className="empty-msg">there are currently no active trellis boards</p>}

                {rooms.map(room => (
                    <div key={room.name} className="room-item">
                        <div className="room-info">
                            <div className="room-name">{room.name}</div>

                        </div>
                        <div className={'room-actions'}>
                            <div className="room-count"> {room.count} active {room.count === 1 ? 'user' : 'users'}</div>
                            <button className="join-button" onClick={() => onJoin(room.name)}>JOIN</button>


                        </div>
                    </div>
                ))}

            </div>
        </div>
    );
}