import React, { useState, useEffect } from 'react';
import '../styles/Lobby.css';

const ACCESS_OPTIONS = [
    { value: 'public', label: 'Public', description: 'Listed and open to everyone' },
    { value: 'locked', label: 'Locked', description: 'Listed; you approve each guest' },
    { value: 'invisible', label: 'Invisible', description: 'Unlisted; guests need the room number' },
];

export default function Lobby({ socket, onCreate, onJoin, joinStatus, onCancelJoin }) {
    const [rooms, setRooms] = useState([]);
    const [roomName, setRoomName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [access, setAccess] = useState('public');
    const [isConnected, setIsConnected] = useState(socket?.connected || false);

    useEffect(() => {
        if (!socket) return;
        const onConnect = () => {
            setIsConnected(true);
            socket.emit('get-rooms');
        };
        const onDisconnect = () => setIsConnected(false);
        const onRoomList = (list) => setRooms(list);

        if (socket.connected) onConnect();
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('room-list', onRoomList);
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('room-list', onRoomList);
        };
    }, [socket]);

    const isBusy = joinStatus?.status === 'loading' || joinStatus?.status === 'pending';
    const submitCreate = (event) => {
        event.preventDefault();
        if (roomName.trim() && isConnected && !isBusy) onCreate(roomName.trim(), access);
    };
    const submitJoin = (event) => {
        event.preventDefault();
        if (roomCode.length === 6 && isConnected && !isBusy) onJoin(roomCode);
    };

    return (
        <div className="lobby">
            <div className="logo-container lobby-logo">
                <img src="/images/trellis.svg" alt="Trellis" />
            </div>
            <h3>LOBBY</h3>
            <p className={`connection-status ${isConnected ? 'connected' : ''}`}>
                {isConnected ? '● Server Connected' : '○ Connecting to Server...'}
            </p>

            {joinStatus && (
                <div className={`join-status ${joinStatus.status}`} role={joinStatus.status === 'error' || joinStatus.status === 'denied' ? 'alert' : 'status'} aria-live="polite">
                    <span>{joinStatus.message}</span>
                    {joinStatus.status === 'pending' && (
                        <button type="button" className="cancel-request-btn" onClick={onCancelJoin}>CANCEL REQUEST</button>
                    )}
                </div>
            )}

            <div className="lobby-forms">
                <form className="create-section" onSubmit={submitCreate}>
                    <h3>Create a room</h3>
                    <label className="field-label" htmlFor="room-name">Room name</label>
                    <input
                        id="room-name"
                        className="room-name-input"
                        value={roomName}
                        onChange={event => setRoomName(event.target.value)}
                        placeholder="Room name..."
                        maxLength={40}
                        disabled={isBusy}
                    />
                    <fieldset className="privacy-options" disabled={isBusy}>
                        <legend>Room privacy</legend>
                        {ACCESS_OPTIONS.map(option => (
                            <label key={option.value} className={`privacy-option ${access === option.value ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="room-privacy"
                                    value={option.value}
                                    checked={access === option.value}
                                    onChange={() => setAccess(option.value)}
                                />
                                <span>
                                    <strong>{option.label}</strong>
                                    <small>{option.description}</small>
                                </span>
                            </label>
                        ))}
                    </fieldset>
                    <button className="create-button" type="submit" disabled={!roomName.trim() || !isConnected || isBusy}>
                        CREATE ROOM
                    </button>
                </form>

                <form className="join-code-section" onSubmit={submitJoin}>
                    <h3>Have a room number?</h3>
                    <p>Enter the six-digit number to find any room, including invisible rooms.</p>
                    <div className="join-code-controls">
                        <label className="sr-only" htmlFor="room-code">Six-digit room number</label>
                        <input
                            id="room-code"
                            className="room-code-input"
                            value={roomCode}
                            onChange={event => setRoomCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            inputMode="numeric"
                            autoComplete="off"
                            disabled={isBusy}
                        />
                        <button className="join-button" type="submit" disabled={roomCode.length !== 6 || !isConnected || isBusy}>
                            FIND ROOM
                        </button>
                    </div>
                </form>
            </div>

            <div className="room-list">
                <h3>Rooms</h3>
                <p className="room-list-caption">Invisible rooms do not appear in this list.</p>
                {rooms.length === 0 && <p className="empty-msg">There are currently no listed rooms.</p>}
                {rooms.map(room => (
                    <div key={room.id} className="room-item">
                        <div className="room-info">
                            <div className="room-name">{room.name}</div>
                            <div className="room-meta">
                                <span>#{room.id}</span>
                                {room.access === 'locked' && <span className="room-privacy-badge">🔒 LOCKED</span>}
                            </div>
                        </div>
                        <div className="room-actions">
                            <div className="room-count">{room.count} active {room.count === 1 ? 'user' : 'users'}</div>
                            <button type="button" className="join-button" onClick={() => onJoin(room.id)} disabled={!isConnected || isBusy}>
                                {room.access === 'locked' ? 'REQUEST TO JOIN' : 'JOIN'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}