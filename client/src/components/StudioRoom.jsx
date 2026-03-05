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
        numBars,
        setNumBars,
        currentBarIdx,
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
        setSampleEnd,
        loadFile,

    } = useSequencer(gridState, socket, roomName);

    const [ isEditingBpm, setIsEditingBpm ] = useState( false );
    const [ isEditingStart, setIsEditingStart ] = useState( false );
    const [ tempBpm, setTempBpm ] = useState(bpm);
    const [viewedBar, setViewedBar] = useState(0);
    const [followPlayhead, setFollowPlayhead] = useState(true);

    const displayBar = Math.max(0, viewedBar);
    const startIndex = displayBar * 16;

    const visiblePads = gridState.slice(startIndex, startIndex + 16).length === 16
        ? gridState.slice(startIndex, startIndex + 16)
        : gridState.slice(0, 16);


    // When a user manually clicks a bar button
    const handleBarClick = (index) => {
        setFollowPlayhead(false); // Stop the jumping
        setViewedBar(index);
    };

    // Auto-follow logic
    useEffect(() => {
        if (followPlayhead) {
            setViewedBar(currentBarIdx);
        }
    }, [currentBarIdx, followPlayhead]);

    // Add a bar
    const addBar = () => {

        // Calculate the new total length
        const newBars = numBars + 1;

        // Create the new pads
        const extraPads = Array.from({ length: 16 }, () => ({
            isActive: false,
            sampleId: null
        }));

        const newState = [...gridState, ...extraPads];


        // Update local state
        setGridState(newState);
        setNumBars(newBars);


        socket.emit('update-entire-grid', {
            roomId: roomName, // Ensure roomId is included
            grid: newState,
            numBars: newBars
        });
    };


    const deleteBar = (barIdx) =>{
        // Prevent deleting last bar
        if(numBars <= 1) return;

        const stepsPerBar = 16;
        const startIndex = barIdx * stepsPerBar;

        // New grid without deleted bar
        const newGrid = [...gridState];
        newGrid.splice(startIndex, stepsPerBar);

        // Update local state
        const newNumBars = numBars - 1;

        setGridState(newGrid);
        setNumBars(newNumBars);

        // If bar deleted was in view - move back 1
        if (viewingBar >= newNumBars) {
            setViewingBar(Math.max(0, numBars - 1));
        }

        // Sync the room
        socket.emit('update-entire-grid', {
            grid: newGrid,
            numBars: newNumBars
        });
    };



    // BPM
    useEffect(() => {
        setTempBpm(bpm);
    }, [bpm]);

    // Sync with server
    useEffect(() => {
        socket.emit('join-room', roomName);

        socket.on('initial-state', (data) => {
            // split grid and bpm
            if (data.grid) setGridState(data.grid);
            if (data.bpm) setBpm(data.bpm);
            if (data.grid) setNumBars(data.grid.length / 16);
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


    const handleInputChange = (e) => {
        setTempBpm(e.target.value);
    };

    const commitBpm = () => {
        const newVal = Number(tempBpm);
        if (!isNaN(newVal)) {
            handleBpmChange(newVal); // This triggers the global setBpm and socket.emit
        }
        setIsEditingBpm(false);
    };



    const handleTogglePlayback = () => {
        const nextState = !isPlaying;
        togglePlayback(); // Local change
        socket.emit('transport-toggle', { isPlaying: nextState }); // Global change
    };

    const handleBpmChange = (newVal) => {
        const clamped = Math.max(30, Math.min(300, newVal));
        setBpm(clamped);
        socket.emit('bpm-change', clamped);
    };

    const handleToggle = (index) => {
        if (!selectedSampleId) {
            alert("Select a sample from the library");
            return;
        }

        setGridState(prev => {
            const next = [...prev];
            const currentIsActive = next[index]?.isActive;

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
            <div className="room-header">
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
                                        value={tempBpm}
                                        onChange={handleInputChange}
                                        onBlur={commitBpm}
                                        onKeyDown={(e) => e.key === "Enter" && commitBpm()}
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

                    <div className='sample-setting' id='end-time-control'>
                        <label>END TIME</label>
                        <div className="nudge-container">
                            <button className="settings-btn"
                                    onClick={() => setSampleEnd(selectedSampleId, (currentSample?.endTime || 0) - 10)}>-
                            </button>
                            <div className="editable-value">
                                <span className="value-display">
                                    {((currentSample?.endTime || 0) / 1000).toFixed(2)}s
                                </span>
                            </div>
                            <button className="settings-btn"
                                    onClick={() => setSampleEnd(selectedSampleId, (currentSample?.endTime || 0) + 10)}>+
                            </button>
                        </div>
                    </div>

                    {currentSample && (
                        <WaveformEditor
                            buffer={currentSample?.buffer}
                            startTime={currentSample?.startTime || 0}
                            endTime={currentSample?.endTime || (currentSample?.buffer.duration * 1000)} // Pass end time
                            onUpdateStart={(newTime) => setSampleStart(selectedSampleId, newTime)}
                            onUpdateEnd={(newTime) => setSampleEnd(selectedSampleId, newTime)} // Pass handler
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

                <div className="sequencer-column">
                    {/* Bar Navigation & Controls */}
                    <div className="bar-controls-row">
                        <div className="bar-navigation">
                            {Array.from({length: numBars}).map((_, i) => (
                                <div key={i} className="bar-btn-wrapper">
                                    <button
                                        onClick={() => handleBarClick(i)}
                                        className={`bar-btn 
                                        ${displayBar === i ? 'viewing' : ''} 
                                        ${currentBarIdx === i ? 'playing' : ''}`}
                                    >
                                        {i + 1}
                                    </button>

                                    {/* Delete button only shows if there's more than one bar */}
                                    {numBars > 1 && (
                                        <button
                                            className="delete-bar-btn"
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent jumping to the deleted bar
                                                deleteBar(i);
                                            }}
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}

                            <button className="add-bar-btn" onClick={addBar}>
                                +
                            </button>
                        </div>

                        <button
                            className={`follow-btn ${followPlayhead ? 'on' : ''}`}
                            onClick={() => setFollowPlayhead(!followPlayhead)}
                        >
                            FOLLOW
                        </button>
                    </div>

                    {/* Sequencer Grid */}
                    <div className="grid-container">
                        <TrellisGrid
                            gridState={visiblePads}
                            activeStep={currentBarIdx === displayBar ? activeStep % 16 : -1}
                            onToggle={(localIdx) => handleToggle(localIdx + startIndex)}
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
                        >⏹
                        </button>
                    </div>


                </div>
            </div>
        </div>
    );
}