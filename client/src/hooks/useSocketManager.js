import { useRef } from "react";

export const useSocketManager = (socket, roomName) => {
    // Global Lock - ignore server for 3s after local input
    const lastLocalUpdate = useRef(0);

    const setLock = () => {
        lastLocalUpdate.current = Date.now();
    };

    const shouldIgnoreServer = () => {
        return Date.now() - lastLocalUpdate.current < 3000;
    };

    const emitEvent = (event, data) => {
        setLock();
        socket.emit(event, { roomId: roomName, ...data });
    };

    return { setLock, shouldIgnoreServer, emitEvent };
};