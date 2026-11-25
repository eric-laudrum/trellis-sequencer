const ACCESS_MODES = new Set(['public', 'locked', 'invisible']);

const normalizeRoomCode = (value) => String(value ?? '').trim();
const normalizeGuestName = (value) => String(value ?? 'Guest').trim().slice(0, 40) || 'Guest';

class RoomStore {
    constructor(random = Math.random) {
        this.rooms = new Map();
        this.random = random;
    }

    createRoom({ name, access = 'public', hostId }) {
        const roomName = String(name ?? '').trim();
        if (!roomName) return { error: 'Enter a room name.' };
        if (roomName.length > 40) return { error: 'Room names must be 40 characters or fewer.' };
        if (!ACCESS_MODES.has(access)) return { error: 'Choose a valid room privacy setting.' };
        if (!hostId) return { error: 'A host is required to create a room.' };

        let id;
        do {
            id = String(Math.floor(this.random() * 1000000)).padStart(6, '0');
        } while (this.rooms.has(id));

        const room = {
            id,
            name: roomName,
            access,
            hostId,
            members: new Set([hostId]),
            pendingRequests: new Map(),
            grid: Array.from({ length: 64 }, () => ({ isActive: false, sampleId: [] })),
            bpm: 88,
            samples: [],
            numBars: 1,
        };
        this.rooms.set(id, room);
        return { room };
    }

    getRoom(code) {
        return this.rooms.get(normalizeRoomCode(code));
    }

    getListedRooms() {
        return [...this.rooms.values()]
            .filter(room => room.access !== 'invisible')
            .map(room => ({
                id: room.id,
                name: room.name,
                access: room.access,
                count: room.members.size,
            }));
    }

    serializeRoom(room, socketId) {
        return {
            id: room.id,
            name: room.name,
            access: room.access,
            isHost: room.hostId === socketId,
        };
    }

    requestJoin(code, socketId, guestName) {
        const room = this.getRoom(code);
        if (!room) return { error: 'No room was found with that room number.' };
        if (room.members.has(socketId)) return { status: 'joined', room };

        if (room.access === 'locked' && room.hostId !== socketId) {
            if (!room.hostId || !room.members.has(room.hostId)) {
                return { error: 'The room host is unavailable. Please try again later.' };
            }

            const request = {
                id: socketId,
                roomId: room.id,
                name: normalizeGuestName(guestName),
            };
            room.pendingRequests.set(socketId, request);
            return { status: 'pending', room, request };
        }

        this.admit(room, socketId);
        return { status: 'joined', room };
    }

    admit(room, socketId) {
        room.members.add(socketId);
        if (!room.hostId) room.hostId = socketId;
        room.pendingRequests.delete(socketId);
    }

    respondToJoin(hostId, code, requestId, approved) {
        const room = this.getRoom(code);
        if (!room) return { error: 'This room no longer exists.' };
        if (room.hostId !== hostId) return { error: 'Only the room host can respond to join requests.' };

        const request = room.pendingRequests.get(requestId);
        if (!request) return { error: 'This join request is no longer pending.' };

        room.pendingRequests.delete(requestId);
        if (approved) this.admit(room, requestId);
        return { room, request };
    }

    updateAccess(hostId, code, access) {
        const room = this.getRoom(code);
        if (!room) return { error: 'This room no longer exists.' };
        if (room.hostId !== hostId) return { error: 'Only the room host can change room privacy.' };
        if (!ACCESS_MODES.has(access)) return { error: 'Choose a valid room privacy setting.' };

        room.access = access;
        const deniedRequests = access === 'locked' ? [] : [...room.pendingRequests.values()];
        if (access !== 'locked') room.pendingRequests.clear();
        return { room, deniedRequests };
    }

    cancelPending(socketId, code) {
        const pending = [];
        for (const room of this.rooms.values()) {
            if (code && room.id !== normalizeRoomCode(code)) continue;
            const request = room.pendingRequests.get(socketId);
            if (request) {
                room.pendingRequests.delete(socketId);
                pending.push({ room, request });
            }
        }
        return pending;
    }

    leave(code, socketId) {
        const room = this.getRoom(code);
        if (!room || !room.members.has(socketId)) return null;

        const previousHostId = room.hostId;
        room.members.delete(socketId);
        if (room.hostId === socketId) {
            room.hostId = room.members.values().next().value || null;
        }

        const deniedRequests = room.hostId ? [] : [...room.pendingRequests.values()];
        if (!room.hostId) room.pendingRequests.clear();
        return { room, previousHostId, newHostId: room.hostId, deniedRequests };
    }
}

module.exports = { ACCESS_MODES, RoomStore };
