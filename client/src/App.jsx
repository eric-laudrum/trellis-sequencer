import { useState, useEffect } from 'react'
import './App.css'
import io from 'socket.io-client';
import * as Tone from 'tone';
import TrellisGrid from './components/TrellisGrid.jsx';
import { useSequencer } from './hooks/useSequencer.js';

const socket = io('http://localhost:4000');

function App() {

    const [ gridState , setGridState ] = useState(new Array(16).fill(false));

    const { activeStep, isPlaying, togglePlayback, bpm, setBpm } = useSequencer( gridState );

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

    const playTestSound = async () =>{
        await Tone.start();
        const synth = new Tone.Synth().toDestination();
        synth.triggerAttackRelease("C4", "8n");
    };


    return (
        <div className='app-container'>
            <h1 className='main-title'>Trellis</h1>

            <div className='controls'>

                <div className='bpm-control'>
                    <label>BPM: {bpm}</label>
                    <input
                        type="range"
                        min="20"
                        max="200"
                        value={bpm}
                        onChange={(e) => setBpm(Number(e.target.value))}
                    />
                </div>
            </div>

            <TrellisGrid
                gridState={gridState}
                onToggle={handleToggle}
                activeStep={activeStep}
            />

            <div className='playControls'>
                <button
                    className={`play-button ${isPlaying ? 'stop' : 'start'}`}
                    onClick={ togglePlayback }
                >
                    { isPlaying ? 'stop' : 'play' }
                </button>
            </div>


            {/* <button onClick={playTestSound}>Play Test</button> */}
        </div>

    );

}


export default App;