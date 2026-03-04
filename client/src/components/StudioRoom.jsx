import React, { useState, useEffect } from "react";
import TrellisGrid  from './TrellisGrid.jsx';
import SampleSidebar from "./SampleSidebar.jsx";
import WaveformEditor from "./WaveformEditor.jsx";
import { useSequencer} from "../hooks/useSequencer.js";
import * as Tone from "tone";
import io from "socket.io-client";


export default function StudioRoom({roomName, socket, onLeave }){

    const [gridState, setGridState] = useState(
        Array.from({ length: 16 }, () => ({ isActive: false, sampleId: null })));

    const {
        activeStep,
        isPlaying,
        togglePlayback,
        stopAll,
        bpm,
        setBpm,
        samples,
        selectedSampleId,
        setSelectedSampleId,
        lastTriggerTime,
        lastTriggerRef,

        setChokeGroup,
        doubleBpm,
        halfBpm,
        tapBpm,
        playSampleSolo,
        setSampleStart,
        loadFile,

    } = useSequencer(gridState, socket, roomName);

    const [ isEditingBpm, setIsEditingBpm ] = useState( false );
    const [ isEditingStart, setIsEditingStart ] = useState( false );


    // Sync with server
    useEffect(() => {
        socket.emit('join-room', roomName);

        socket.on('initial-state', (data) => {
            // split grid and bpm
            if (data.grid) setGridState(data.grid);
            if (data.bpm) setBpm(data.bpm);
        });

        socket.on('update-state', ({ index, newState }) => {
            setGridState(prev => {
                const next = [...prev];
                next[index] = newState;
                return next;
            });
        });

        return () => {
            socket.off('initial-state');
            socket.off('update-state');
        };
    }, [roomName, socket, setBpm ]);


    const handleTogglePlayback = () => {
        const nextState = !isPlaying;
        togglePlayback(); // Local change
        socket.emit('transport-toggle', { isPlaying: nextState }); // Global change
    };

    const handleBpmChange = (newVal) => {
        setBpm(newVal);
        socket.emit('bpm-change', newVal);
    };

    const handleToggle = (index) => {
        console.log("Clicked pad:", index, "Selected Sample:", selectedSampleId);
        if (!selectedSampleId){
            alert("Select a sample from the library");
            return;
        }

        setGridState(prev => {
            const next = [...prev];
            const currentIsActive = next[index].isActive;

            next[index] = {
                ...next[index],
                isActive: !currentIsActive,
                sampleId: !currentIsActive ? selectedSampleId : null,
            };

            socket.emit('pad-toggle', { index, newState: next[index] });
            return next;
        });
    };

    const nudgeStart = (amount) => {
        const nextValue = Math.max(0, Math.min(20000, sampleStart + amount));
        setSampleStart(nextValue);
    };

    const handleFileChange = (evt) => {
        const file = evt.target.files[0];
        if (file) loadFile(file);
    };

    const currentSample = samples.find(s => s.id === selectedSampleId);


    return (
        <div className='app-container'>
            <div className="room-nav">
                <button className="settings-btn" onClick={onLeave}>← EXIT STUDIO</button>
                <h1 className='main-title'>STUDIO: {roomName}</h1>
            </div>

            <div className="seq-header">
                <div className='sample-settings'>
                    {/* BPM Control */}
                    <div className='sample-setting' id='bpm-control'>
                        <label>BPM</label>
                        <div className="bpm-controls-wrapper">

                            {/*  BPM /2 */}
                            <button
                                className="settings-btn"
                                onClick={() => handleBpmChange(bpm / 2)}>/2
                            </button>

                            <div className="editable-value">
                                {isEditingBpm ? (
                                    <input
                                        autoFocus
                                        className="inline-input"
                                        type="number"
                                        value={bpm}
                                        onChange={(e) => handleBpmChange(Number(e.target.value))}
                                        onBlur={() => setIsEditingBpm(false)}
                                    />
                                ) : (
                                    <span className="value-display" onClick={() => setIsEditingBpm(true)}>{bpm}</span>
                                )}
                            </div>

                            {/*  BPM x2 */}
                            <button
                                className="settings-btn"
                                onClick={() => handleBpmChange(bpm * 2)}>x2
                            </button>

                            <button className="tap-btn" onClick={tapBpm}>TAP</button>
                        </div>
                    </div>

                    {/* Start Time Control */}
                    <div className='sample-setting' id='start-time-control'>
                        <label>START TIME</label>
                        <div className="nudge-container">
                            <button className="settings-btn"
                                    onClick={() => setSampleStart(selectedSampleId, (currentSample?.startTime || 0) - 10)}>-
                            </button>
                            <div className="editable-value">
                                <span className="value-display">
                                    {((currentSample?.startTime || 0) / 1000).toFixed(2)}s
                                </span>
                            </div>
                            <button className="settings-btn"
                                    onClick={() => setSampleStart(selectedSampleId, (currentSample?.startTime || 0) + 10)}>+
                            </button>
                        </div>
                    </div>

                    {currentSample && (
                        <WaveformEditor
                            buffer={currentSample?.buffer}
                            startTime={currentSample?.startTime || 0}
                            onUpdateStart={(newTime) => setSampleStart(selectedSampleId, newTime)}
                            isPlaying={isPlaying}
                            lastTriggerTime={lastTriggerTime}
                            lastTriggerRef={lastTriggerRef}
                        />
                    )}
                </div>
            </div>

            <div className="seq-main">
                <SampleSidebar
                    samples={samples}
                    onSetChokeGroup={setChokeGroup}
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
                    className={`play-button ${isPlaying ? 'pause' : 'start'}`}
                    onClick={handleTogglePlayback}
                >
                    {isPlaying ? '⏸︎' : '▶'}
                </button>

                <button className="stop-button"
                        onClick={stopAll}
                >⏹</button>
            </div>
        </div>
    );
}