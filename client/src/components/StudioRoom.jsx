// StudioRoom.jsx
import React, { useState, useEffect } from "react";
import TrellisGrid  from './TrellisGrid.jsx';
import SampleSidebar from "./SampleSidebar.jsx";
import WaveformEditor from "./WaveformEditor.jsx";
import { useSequencer } from "../hooks/useSequencer.js";
import ChatPanel from "./ChatPanel.jsx";

import "../styles/StudioRoom.css";

export default function StudioRoom({ roomName, socket, onLeave }) {

    const [padCount, setPadCount] = useState(64); // 8x8

    // tmp
    const [gridState, setGridState] = useState(
        Array.from({ length: 64 }, () => ({ isActive: false, sampleId: null, userId: null }))
    );

    const gridDimension = Math.sqrt(padCount);

    const {
        activeStep,
        numBars,
        currentBarIdx,
        isPlaying,
        bpm,
        samples,
        selectedSampleId,
        lastTriggerTime,
        lastTriggerRef,
        togglePlayback,
        setSelectedSampleId,
        addBar,
        deleteBar,
        duplicateSample,
        stopAll,
        loadFile,
        tapBpm,
        setBpm,
        playSampleSolo,
        setSampleStart,
        setSampleEnd,
        setSampleColor,
        setChokeGroup,

    } = useSequencer(gridState, setGridState, socket, roomName, gridDimension, gridDimension);

    const [isEditingBpm, setIsEditingBpm] = useState(false);
    const [tempBpm, setTempBpm] = useState(bpm);
    const [viewedBar, setViewedBar] = useState(0);
    const [followPlayhead, setFollowPlayhead] = useState(true);


    // Auto-follow logic
    useEffect(() => {
        if (followPlayhead) {
            setViewedBar(currentBarIdx);
        }
    }, [currentBarIdx, followPlayhead]);

    useEffect(() => {
        setTempBpm(bpm);
    }, [bpm]);

    const displayBar = Math.max(0, viewedBar);
    const startIndex = displayBar * padCount;
    const visiblePads = gridState ? gridState.slice(startIndex, startIndex + padCount) : [];

    const handleBarClick = (index) => {
        setFollowPlayhead(false);
        setViewedBar(index);
    };

    const commitBpm = () => {
        const newVal = Number(tempBpm);
        if (!isNaN(newVal)) setBpm(newVal);
        setIsEditingBpm(false);
    };

    const handleToggle = (index) => {
        if (!selectedSampleId) {
            alert("Select a sample from the library");
            return;
        }

        setGridState(prev => {
            const next = [...prev];
            const currentIsActive = next[index]?.isActive;
            const updatedPad = {
                ...next[index],
                isActive: !currentIsActive,
                sampleId: !currentIsActive ? selectedSampleId : null,
                userId: !currentIsActive ? socket.id : null, // Record user's socket ID
            };
            next[index] = updatedPad;

            socket.emit('pad-toggle', { index, newState: updatedPad });

            return next;
        });
    };

    const currentSample = samples.find(s => s.id === selectedSampleId);

    return (
        <div className='app-container'>
            <div className="room-header">
                <h1 className='main-title'>STUDIO: {roomName}</h1>
                <button className="settings-btn" onClick={onLeave}>← EXIT</button>
            </div>

            <div className="seq-header">
                {currentSample ? (
                    <div className="sample-settings">

                        <div className="sample-control-strip">
                            <span className="value-display">{currentSample.name}</span>

                            {/* Start Time Input */}
                            <div className="sample-setting">
                                <span style={{fontSize: '10px', color: 'gray', marginRight: '5px'}}>START</span>
                                <input
                                    type="number"
                                    className="inline-input"
                                    value={Math.round(currentSample.startTime || 0)}
                                    onChange={(e) => setSampleStart(currentSample.id, Number(e.target.value))}
                                />
                            </div>

                            {/* End Time Input */}
                            <div className="sample-setting">
                                <span style={{fontSize: '10px', color: 'gray', marginRight: '5px'}}>END</span>
                                <input
                                    type="number"
                                    className="inline-input"
                                    value={Math.round(currentSample.endTime || (currentSample.buffer ? currentSample.buffer.duration * 1000 : 1000))}
                                    onChange={(e) => setSampleEnd(currentSample.id, Number(e.target.value))}
                                />
                            </div>

                            {/* Choke Group Selector */}
                            <div className="sample-setting choke-select">
                                <span style={{fontSize: '10px', color: 'gray', marginRight: '5px'}}>CHOKE</span>
                                <select
                                    className="group-select"
                                    value={currentSample.chokeGroup || "none"}
                                    onChange={(e) => setChokeGroup(currentSample.id, e.target.value)}
                                >
                                    <option value="none">-</option>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                </select>
                            </div>

                            <button
                                className="settings-btn"
                                style={{
                                    marginLeft: 'auto',
                                    backgroundColor: '#f1ad36',
                                    color: '#000',
                                    fontWeight: 'bold'
                                }}
                                onClick={() => duplicateSample(currentSample.id)}
                            >
                                + CREATE SLICE
                            </button>
                        </div>

                        <WaveformEditor
                            buffer={currentSample.buffer}
                            startTime={currentSample.startTime || 0}
                            endTime={currentSample.endTime || (currentSample.buffer ? currentSample.buffer.duration * 1000 : 1000)}
                            onUpdateStart={(val) => setSampleStart(currentSample.id, val)}
                            onUpdateEnd={(val) => setSampleEnd(currentSample.id, val)}
                            isPlaying={isPlaying}
                            lastTriggerTime={lastTriggerTime}
                            lastTriggerRef={lastTriggerRef}
                        />
                    </div>
                ) : (
                    <div style={{padding: '20px', color: '#666', textAlign: 'center'}}>
                        Select a sample from the library to edit
                    </div>
                )}
            </div>

            <div className="seq-main">
                <SampleSidebar
                    samples={samples}
                    duplicateSample={duplicateSample}
                    onSetColor={setSampleColor}
                    onSetChokeGroup={setChokeGroup}
                    selectedId={selectedSampleId}
                    onSelect={setSelectedSampleId}
                    onUpload={(e) => e.target.files[0] && loadFile(e.target.files[0])}
                    onPlaySolo={playSampleSolo}
                />

                <div className="sequencer-column">
                    <div className="bar-controls-row">
                        <div className="bar-navigation">
                            {Array.from({length: numBars || 1}).map((_, i) => (
                                <div key={i} className="bar-btn-wrapper">
                                    <button
                                        onClick={() => handleBarClick(i)}
                                        className={`bar-btn ${displayBar === i ? 'viewing' : ''} ${(currentBarIdx || 0) === i ? 'playing' : ''}`}
                                    >
                                        {i + 1}
                                    </button>

                                    {/* The restored delete button */}
                                    {numBars > 1 && (
                                        <button
                                            className="delete-bar-btn"
                                            onClick={() => deleteBar(i)}
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button className="add-bar-btn" onClick={addBar}>+</button>
                            <button className={`follow-btn ${followPlayhead ? 'on' : ''}`}
                                    onClick={() => setFollowPlayhead(!followPlayhead)}>FOLLOW
                            </button>
                        </div>
                    </div>

                    <div className="grid-and-controls-wrapper">
                        <div className="grid-container">
                            <TrellisGrid
                                gridState={visiblePads}
                                activeStep={currentBarIdx === displayBar ? activeStep % padCount : -1}
                                onToggle={(localIdx) => handleToggle(localIdx + startIndex)}
                                padCount={padCount}
                                samples={samples}
                            />
                        </div>

                        <div className='play-controls' style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                            <button className={`play-button ${isPlaying ? 'pause' : 'start'}`} onClick={togglePlayback}>
                                {isPlaying ? '⏸︎' : '▶'}
                            </button>
                            <button className="stop-button" onClick={stopAll}>⏹</button>

                            <div className="bpm-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '20px' }}>
                                <button className="settings-btn" onClick={tapBpm}>
                                    TAP
                                </button>
                                {isEditingBpm ? (
                                    <input
                                        type="number"
                                        className="inline-input"
                                        style={{ width: '60px', textAlign: 'center' }}
                                        value={tempBpm}
                                        onChange={(e) => setTempBpm(e.target.value)}
                                        onBlur={commitBpm}
                                        onKeyDown={(e) => e.key === 'Enter' && commitBpm()}
                                        autoFocus
                                    />
                                ) : (
                                    <span
                                        style={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: '1.2rem', color: '#f5820a', fontWeight: 'bold' }}
                                        onClick={() => setIsEditingBpm(true)}
                                        title="Click to edit BPM"
                                    >
                                        {Math.round(bpm)} BPM
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <ChatPanel socket={socket} roomName={roomName}/>
            </div>
        </div>
    );
}