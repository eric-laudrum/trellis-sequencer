import { useState, useEffect } from 'react'
import './App.css'
import io from 'socket.io-client';
import * as Tone from 'tone';

import TrellisGrid from './components/TrellisGrid.jsx';
import SampleSidebar from "./components/SampleSidebar.jsx";
import WaveformEditor from "./components/WaveformEditor.jsx";

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
        playSampleSolo,
        lastTriggerTime,

    } = useSequencer(gridState);

    const [ isEditingBpm, setIsEditingBpm ] = useState( false );
    const [ isEditingStart, setIsEditingStart ] = useState( false );

    const nudgeStart = ( amount ) =>{
        const nextValue = Math.max( 0, Math.min( 20000, sampleStart + amount ));
        setSampleStart( nextValue );
    };

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

    const currentSample = samples.find( sample => sample.id === selectedSampleId );

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
                        <label>BPM</label>
                        <div className="editable-value">
                            {isEditingBpm ? (
                                <input
                                    autoFocus
                                    className="inline-input"
                                    type="number"
                                    value={bpm}
                                    onChange={(e) => setBpm(Number(e.target.value))}
                                    onBlur={() => setIsEditingBpm(false)}
                                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingBpm(false)}
                                />
                            ) : (
                                <span className="value-display" onClick={() => setIsEditingBpm(true)}>{bpm}</span>
                            )}
                        </div>
                    </div>

                    {/* ------ Start Time ------*/}
                    <div className='sample-setting' id='start-time-control'>
                        <label>START TIME</label>
                        <div className="nudge-container">
                            <button className="nudge-btn" onClick={() => nudgeStart(-10)}>-</button>

                            <div className="editable-value">
                                {isEditingStart ? (
                                    <input
                                        autoFocus
                                        className="inline-input"
                                        type="number"
                                        step="0.01"
                                        value={(sampleStart / 1000).toFixed(2)}
                                        onChange={(e) => setSampleStart(Number(e.target.value) * 1000)}
                                        onBlur={() => setIsEditingStart(false)}
                                        onKeyDown={(e) => e.key === 'Enter' && setIsEditingStart(false)}
                                    />
                                ) : (
                                    <span className="value-display" onClick={() => setIsEditingStart(true)}>
                                        {(sampleStart / 1000).toFixed(2)}s
                                    </span>
                                )}
                            </div>

                            <button className="nudge-btn" onClick={() => nudgeStart(10)}>+</button>
                        </div>
                    </div>

                    {currentSample && (
                        <WaveformEditor
                            buffer={ currentSample.buffer }
                            startTime={ sampleStart }
                            onUpdateStart={ setSampleStart }
                            isPlaying={ isPlaying }
                            lastTriggerTime={lastTriggerTime}
                        />
                    )}

                </div>

            </div>

            <div className="seq-main">
                <SampleSidebar
                    samples={samples}
                    selectedId={selectedSampleId}
                    onSelect={setSelectedSampleId}
                    onUpload={handleFileChange}
                    onPlaySolo={playSampleSolo}
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