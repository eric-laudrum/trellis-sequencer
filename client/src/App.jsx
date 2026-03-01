import { useState, useEffect } from 'react'
import './App.css'
import io from 'socket.io-client';
import * as Tone from 'tone';
import TrellisGrid from './components/TrellisGrid.jsx';
import SampleSidebar from "./components/SampleSidebar.jsx";
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
        loadFile,
        sampleStart,
        setSampleStart,
        samples,
        selectedSampleId,
        setSelectedSampleId,

    } = useSequencer(gridState);

    const handleFileChange = (evt) => {
        const file = evt.target.files[0];
        if( file ){
            loadFile( file );
        }
    };

    const handleToggle = (index) => {

        if( !selectedSampleId ) return;

        setGridState(prev => {
            const next = [...prev];

            const currentIsActive = next[ index ].isActive;

            // Toggle isActive
            next[index] = {
                ...next[index],
                isActive: !currentIsActive,
                sampleId: !currentIsActive ? selectedSampleId : null,
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

    // Set Grid
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

    return (
        <div className='app-container'>

            <h1 className='main-title'>TRELLIS</h1>

            <div className="seq-header">
                {/* ------------ Controls ------------*/}
                <div className='sample-settings'>

                    {/* ------ BPM ------*/}
                    <div className='sample-setting' id='bpm-control'>
                        <label>BPM: {bpm}</label>
                        <input className='number-input'
                            type="number"
                            step="0.01"
                            value={ bpm.toFixed(2)}
                            onChange={(e) => setBpm(Number(e.target.value))}
                        />
                        <input
                            type="range"
                            min="1"
                            max="200"
                            value={ bpm }
                            onChange={(e) => setBpm(Number(e.target.value))}
                        />
                    </div>

                    {/* ------ Start Time ------*/}
                    <div className='sample-setting' id='start-time-control'>
                        <label>START TIME</label>
                        <input className='number-input'
                            type="number"
                            step="0.01"
                            value={(sampleStart / 1000).toFixed(2)}
                            onChange={(e) => setSampleStart(Number(e.target.value) * 1000)}
                        />
                        <input
                            type="range"
                            min="0"
                            max="20000"
                            step="1"
                            value={sampleStart}
                            onChange={(e) => setSampleStart(Number(e.target.value))}
                        />
                    </div>

                </div>

            </div>

            <div className="seq-main">
                <SampleSidebar
                    samples={ samples }
                    selectedId={ selectedSampleId }
                    onSelect={ setSelectedSampleId }
                    onUpload={handleFileChange}
                />

                <TrellisGrid
                    gridState={gridState}
                    onToggle={handleToggle}
                    activeStep={activeStep}
                />
            </div>


            <div className='play-controls'>
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