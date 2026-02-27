import { useState, useEffect } from 'react'
import './App.css'
import io from 'socket.io-client';
import * as Tone from 'tone';
import TrellisGrid from './components/TrellisGrid.jsx';
import { useSequencer } from './hooks/useSequencer.js';

const socket = io('http://localhost:4000');

function App() {

    const [gridState, setGridState] = useState(
        Array.from({ length: 16 }, () => ({
            isActive: false,
            sampleId: null
        }))
    );

    const {
        activeStep,
        isPlaying,
        togglePlayback,
        bpm,
        setBpm,
        loadFile
    } = useSequencer(gridState);

    const handleFileChange = (evt) => {
        const file = evt.target.files[0];
        if( file ){
            loadFile( file );
        }
    };




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


    const handleToggle = (index) => {
        setGridState(prev => {
            const next = [...prev];

            const currentIsActive = next[ index ].isActive;

            // Toggle isActive
            next[index] = {
                ...next[index],
                isActive: !currentIsActive
            };

            // Emit the object to the server
            socket.emit('pad-toggle', { index, newState: next[index] });

            return next;
        });
    };

    const playTestSound = async () =>{
        await Tone.start();
        const synth = new Tone.Synth().toDestination();
        synth.triggerAttackRelease("C4", "8n");
    };


    return (
        <div className='app-container'>
            <h1 className='main-title'>Trellis</h1>

            <div className="upload-section">
                <label>Upload Sound for Row 1: </label>
                <input type="file" accept="audio/*" onChange={ handleFileChange }/>
            </div>

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
                    onClick={togglePlayback}
                >
                    {isPlaying ? 'stop' : 'play'}
                </button>
            </div>


            {/* <button onClick={playTestSound}>Play Test</button> */}
        </div>

    );

}


export default App;