import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import io from 'socket.io-client';
import * as Tone from 'tone';
import TrellisGrid from './components/TrellisGrid.jsx';

const socket = io('http://localhost:4000');

function App() {

    const playTestSound = async () =>{
        await Tone.start();
        const synth = new Tone.Synth().toDestination();
        synth.triggerAttackRelease("C4", "8n");
    };

    const [ gridState, setGridState ] = useState(new Array(16).fill(false));

    useEffect(() =>{
        socket.on('initial-state', (data) => setGridState(data));

        socket.on('update-state', ({ index, newState }) =>
            setGridState(prev =>{
                const next = [...prev];
                next[ index ] = newState;
                return next;
            })
        );
        return () => socket.off();
    }, []);


    const handleToggle = (index )=>{
        const newState = !gridState[ index ];

        // Update UI
        setGridState(prev =>{
            const next = [...prev];
            next[ index ] = newState;
            return next;

        });
        socket.emit('pad-toggle', { index, newState });
    };

    return(
        <div className='app-container'>
            <h1 className='main-title'>Trellis</h1>
            <TrellisGrid
                gridState={ gridState }
                onToggle={ handleToggle }
            />
            <button onClick={playTestSound}>Play Test</button>
        </div>
    );
}

export default App;