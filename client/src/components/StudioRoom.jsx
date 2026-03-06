import React, { useState, useEffect } from "react";
import TrellisGrid  from './TrellisGrid.jsx';
import SampleSidebar from "./SampleSidebar.jsx";
import WaveformEditor from "./WaveformEditor.jsx";
import { useSequencer } from "../hooks/useSequencer.js";

export default function StudioRoom({ roomName, socket, onLeave }) {

    const [gridState, setGridState] = useState(
        Array.from({ length: 16 }, () => ({ isActive: false, sampleId: null }))
    );

    const {
        activeStep,
        numBars,
        currentBarIdx,
        isPlaying,
        togglePlayback,
        bpm,
        samples,
        selectedSampleId,
        setSelectedSampleId,
        addBar,
        deleteBar,
        lastTriggerTime,
        lastTriggerRef,
        stopAll,

        loadFile,
        tapBpm,
        setBpm,
        playSampleSolo,
        setSampleStart,
        setSampleEnd,
        setChokeGroup
    } = useSequencer(gridState, setGridState, socket, roomName);

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

    // Sync tempBpm with actual bpm
    useEffect(() => {
        setTempBpm(bpm);
    }, [bpm]);

    const displayBar = Math.max(0, viewedBar);
    const startIndex = displayBar * 16;

    const visiblePads = gridState ? gridState.slice(startIndex, startIndex + 16) : [];

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

        const next = [...gridState];
        const currentIsActive = next[index]?.isActive;
        next[index] = {
            ...next[index],
            isActive: !currentIsActive,
            sampleId: !currentIsActive ? selectedSampleId : null,
        };

        setGridState(next);
        socket.emit('pad-toggle', { index, newState: next[index] });
    };

    const currentSample = samples.find(s => s.id === selectedSampleId);

    return (
        <div className='app-container'>
            <div className="room-header">
                <h1 className='main-title'>STUDIO: {roomName}</h1>
                <button className="settings-btn" onClick={onLeave}>← EXIT</button>

            </div>

            <div className="seq-header">

            {/* Sample Settings */}
                <div className='sample-settings'>
                    {currentSample ? (
                        <>
                            {/* Sample Controls */}
                            <div className='sample-control-strip'>

                                {/* BPM controls */}
                                <div className='sample-setting' id='bpm-control'>
                                    <label>BPM</label>

                                    <div className="bpm-controls-wrapper">
                                        <button className="settings-btn" onClick={() => setBpm(bpm / 2)}>/2</button>
                                        <div className="editable-value">
                                            {isEditingBpm ? (
                                                <input
                                                    autoFocus
                                                    className="inline-input"
                                                    type="number"
                                                    value={tempBpm}
                                                    onChange={(e) => setTempBpm(e.target.value)}
                                                    onBlur={commitBpm}
                                                    onKeyDown={(e) => e.key === "Enter" && commitBpm()}
                                                />
                                            ) : (
                                                <span className="value-display"
                                                      onClick={() => setIsEditingBpm(true)}>{bpm}</span>
                                            )}
                                        </div>
                                        <button className="settings-btn" onClick={() => setBpm(bpm * 2)}>x2</button>
                                        <button className="tap-btn" onClick={tapBpm}>TAP</button>
                                    </div>
                                </div>

                                {/* Sample Start Time */}
                                <div className='sample-setting'>
                                    <label>START TIME</label>

                                    <button className="settings-btn" onClick={() => setSampleStart(selectedSampleId, (currentSample?.startTime || 0) - 10)}>
                                        -
                                    </button>

                                    <span className="value-display">{((currentSample?.startTime || 0) / 1000).toFixed(2)}
                                        s
                                    </span>

                                    <button className="settings-btn"
                                            onClick={() => setSampleEnd(selectedSampleId, (currentSample?.endTime || 0) + 10)}>
                                        +
                                    </button>

                                </div>

                                {/* Sample End Time */}
                                <div className='sample-setting'>
                                    <label>END TIME</label>
                                    <div className="nudge-container">

                                        <button className="settings-btn"
                                                onClick={() => setSampleEnd(selectedSampleId, (currentSample?.endTime || 0) - 10)}>
                                            -
                                        </button>

                                        <span
                                            className="value-display">{((currentSample?.endTime || 0) / 1000).toFixed(2)}s</span>

                                        <button className="settings-btn"
                                                onClick={() => setSampleEnd(selectedSampleId, (currentSample?.endTime || 0) + 10)}>
                                            +
                                        </button>

                                    </div>
                                </div>

                                {/* Play sample */}
                                <button className="preview-btn" onClick={() => playSampleSolo(selectedSampleId)}>
                                    ▶
                                </button>

                            </div>

                        </>

                    ) : (
                        <div className="no-selection-message">
                            <p>Select a sample to edit parameters</p>
                        </div>

                    )}
                </div>


                    {currentSample && (
                        <WaveformEditor
                        buffer={currentSample.buffer}
                    startTime={currentSample.startTime}
                    endTime={currentSample.endTime}
                        onUpdateStart={(newTime) => setSampleStart(selectedSampleId, newTime)}
                        onUpdateEnd={(newTime) => setSampleEnd(selectedSampleId, newTime)}
                        isPlaying={isPlaying}
                        lastTriggerTime={lastTriggerTime}
                        lastTriggerRef={lastTriggerRef}
                    />
                )}
            </div>

            <div className="seq-main">
                <SampleSidebar
                    samples={samples}
                    onSetChokeGroup={setChokeGroup}
                    selectedId={selectedSampleId}
                    onSelect={setSelectedSampleId}
                    onUpload={(e) => e.target.files[0] && loadFile(e.target.files[0])}
                    onPlaySolo={playSampleSolo}
                />

                <div className="sequencer-column">

                    {/* Bar Controls */}
                    <div className="bar-controls-row">
                        <div className="bar-navigation">
                            {Array.from({ length: numBars || 1 }).map((_, i) => (
                                <div key={i} className="bar-btn-wrapper">
                                    <button
                                        onClick={() => handleBarClick(i)}
                                        className={`bar-btn 
                                            ${displayBar === i ? 'viewing' : ''} 
                                            ${(currentBarIdx || 0) === i ? 'playing' : ''}`}
                                    >
                                        {i + 1}
                                    </button>
                                    {(numBars || 1) > 1 && (
                                        <button
                                            className="delete-bar-btn"
                                            onClick={(e) => {
                                                e.stopPropagation(); // Don't switch to view being deleted
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
                        <button className={`follow-btn ${followPlayhead ? 'on' : ''}`} onClick={() => setFollowPlayhead(!followPlayhead)}>FOLLOW</button>
                    </div>

                    <div className="grid-and-controls-wrapper">
                        {/* Seq Grid */}
                        <div className="grid-container">
                            <TrellisGrid
                                gridState={visiblePads}
                                activeStep={currentBarIdx === displayBar ? activeStep % 16 : -1}
                                onToggle={(localIdx) => handleToggle(localIdx + startIndex)}
                            />
                        </div>

                        {/* Play Controls */}
                        <div className='play-controls'>
                            <button className={`play-button ${isPlaying ? 'pause' : 'start'}`} onClick={togglePlayback}>
                                {isPlaying ? '⏸︎' : '▶'}
                            </button>
                            <button className="stop-button" onClick={stopAll}>
                                ⏹
                            </button>
                        </div>
                    </div>


                </div>
            </div>
        </div>
    );
}