import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import * as Tone from 'tone';
import Lobby from "./components/Lobby.jsx";
import StudioRoom from "./components/StudioRoom.jsx";
import './App.css';
import HomePage from "./pages/HomePage.jsx";
import AccountStatus from "./components/AccountStatus.jsx";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    timeout: 10000
});

const emitWithAck = (event, payload) => new Promise((resolve, reject) => {
    socket.timeout(10000).emit(event, payload, (error, response) => {
        if (error) reject(new Error('The server did not respond. Please try again.'));
        else resolve(response);
    });
});

const getGuestName = () => {
    const storedUser = localStorage.getItem('trellis_user');
    if (storedUser) {
        try {
            const parsed = JSON.parse(storedUser);
            const customName = localStorage.getItem(`trellis_custom_name_${parsed.email}`);
            return customName || parsed.email?.split('@')[0] || 'Guest';
        } catch {
            // Fall back to the guest name below.
        }
    }
    return localStorage.getItem('trellis_guest_name') || 'Guest';
};

function App() {
    const [room, setRoom] = useState(null);
    const [view, setView] = useState('home');
    const [joinStatus, setJoinStatus] = useState(null);

    const enterRoom = (nextRoom) => {
        setRoom(nextRoom);
        setJoinStatus(null);
        setView('studio');
    };

    useEffect(() => {
        const onJoinApproved = ({ room: approvedRoom }) => enterRoom(approvedRoom);
        const onJoinDenied = ({ roomId, message }) => {
            setJoinStatus(current => {
                if (!current || current.code !== roomId) return current;
                return { ...current, status: 'denied', message };
            });
        };
        const onRoomAccessUpdated = ({ room: updatedRoom }) => {
            setRoom(current => current?.id === updatedRoom.id ? updatedRoom : current);
        };

        socket.on('join-approved', onJoinApproved);
        socket.on('join-denied', onJoinDenied);
        socket.on('room-access-updated', onRoomAccessUpdated);
        return () => {
            socket.off('join-approved', onJoinApproved);
            socket.off('join-denied', onJoinDenied);
            socket.off('room-access-updated', onRoomAccessUpdated);
        };
    }, []);

    const startAudio = async () => {
        try {
            await Tone.start();
        } catch (error) {
            console.error("Audio context initialization failed.", error);
        }
    };

    const handleCreate = async (name, access) => {
        await startAudio();
        setJoinStatus({ status: 'loading', message: 'Creating room…' });
        try {
            const response = await emitWithAck('create-room', { name, access });
            if (response.status === 'error') {
                setJoinStatus({ status: 'error', message: response.message });
                return;
            }
            enterRoom(response.room);
        } catch (error) {
            setJoinStatus({ status: 'error', message: error.message });
        }
    };

    const handleJoin = async (code) => {
        const normalizedCode = String(code).trim();
        await startAudio();
        setJoinStatus({ code: normalizedCode, status: 'loading', message: 'Finding room…' });
        try {
            const response = await emitWithAck('join-room', {
                code: normalizedCode,
                guestName: getGuestName(),
            });
            if (response.status === 'error') {
                setJoinStatus({ code: normalizedCode, status: 'error', message: response.message });
            } else if (response.status === 'pending') {
                setJoinStatus({
                    code: normalizedCode,
                    status: 'pending',
                    message: `Waiting for the host of ${response.room.name} to approve your request…`,
                });
            } else {
                enterRoom(response.room);
            }
        } catch (error) {
            setJoinStatus({ code: normalizedCode, status: 'error', message: error.message });
        }
    };

    const handleCancelJoin = () => {
        if (joinStatus?.code) socket.emit('cancel-join', joinStatus.code);
        setJoinStatus(null);
    };

    const handleLeave = () => {
        if (room) socket.emit('leave-room', room.id);
        setRoom(null);
        setJoinStatus(null);
        setView('lobby');
    };

    return (
        <div className="app-root">
            {!room && <AccountStatus />}

            {view === 'home' && (
                <HomePage onEnterLobby={() => setView('lobby')} />
            )}

            {view === 'lobby' && (
                <Lobby
                    socket={socket}
                    onCreate={handleCreate}
                    onJoin={handleJoin}
                    joinStatus={joinStatus}
                    onCancelJoin={handleCancelJoin}
                />
            )}

            {view === 'studio' && room && (
                <StudioRoom room={room} socket={socket} onLeave={handleLeave} />
            )}
        </div>
    );
}

export default App;