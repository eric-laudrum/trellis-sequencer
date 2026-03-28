import React, { useState, useEffect, useRef } from "react";


export default function ChatPanel({ socket, roomName }) {

    const [ message, setMessage ] = useState("");
    const [ input, setInput ] = useState("");
    const scrollRef = useRef(null);

    // Listen for messages
    useEffect(() => {
        socket.on('chat-message', (msg) => {
            setMessage((prevMessages) => [...prevMessages, msg]);
        });

        return () => socket.off('chat-message');
    }, [ socket ]);

    // Send a message
    const sendMessage = (event) => {
        event.preventDefault();
        if(!input.trim()) return;

        const messageData = {
            roomName,
            text: input,
            user: socket.id.substring(0, 5),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        socket.emit('send-message', messageData);
        setMessages((prevMessages) => [...prevMessages, messageData]);
        setInput('');
    };

    return(
        <div className="chat-panel">

            <h1>CHAT PANEL</h1>


        </div>
    )


}