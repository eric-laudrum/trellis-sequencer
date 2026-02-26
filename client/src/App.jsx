import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import io from 'socket.io-client';
import * as Tone from 'tone';

const socket = io('http://localhost:4000');

function App() {
    const playTestSound = async () =>{
        await Tone.start();
        const synth = new Tone.Synth().toDestination();
        synth.triggerAttackRelease("C4", "8n");
    };

    return(
        <div>
            <h1>Trellis</h1>
            <button onClick={playTestSound}>Play Test</button>
        </div>
    );
}

export default App;