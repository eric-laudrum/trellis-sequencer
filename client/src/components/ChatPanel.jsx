import React, { useState, useEffect, useRef } from "react";


export default function ChatPanel({ socket, roomName }) {

    const [ messages, setMessages ] = useState([]);
    const [ input, setInput ] = useState("");
    const scrollRef = useRef(null);

    // Listen for messages
    useEffect(() => {
        if(!socket) return;

        socket.on('chat-message', (message) => {
            setMessages((prevMessages) => [...prevMessages, message]);
        });

        return () => socket.off('chat-message');
    }, [ socket ]);


    //
    useEffect(() => {
        if (!socket) return;

        const handleMessage = (message) => {
            // Debugging
            console.log("New message received:", message);
            setMessages((prev) => [...prev, message]);
        };

        socket.on('chat-message', handleMessage);

        return () => {
            socket.off('chat-message', handleMessage);
        };
    }, [socket]);

    // Send a message
    const sendMessage = (event) => {
        event.preventDefault();
        if(!input.trim() || !socket?.id) return;

        const messageData = {
            roomName,
            text: input,
            user: socket.id.substring(0, 5),
            timestamp: new Date().toLocaleTimeString([],
                { hour: '2-digit', minute: '2-digit' }),
        };

        // Send message and reset fields
        socket.emit('send-message', messageData);
        setMessages((prevMessages) => [...prevMessages, messageData]);
        setInput('');
    };

    return(
        <div className="chat-panel">

            <div className="chat-header">
                <h2 className="chat-title">CHAT PANEL</h2>
            </div>


            <div className="messages" ref={scrollRef}>
                { messages.map((message, index) => (
                    <div key={index} className="message">
                        <span className="chat-user">[{message.user}]</span>
                        <span className="chat-text">{message.text}</span>
                    </div>
                ))}
            </div>
            <form onSubmit={sendMessage} className="chat-input-area">
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Enter Your Message" />
                <button type="submit">→</button>
            </form>


        </div>
    )


}