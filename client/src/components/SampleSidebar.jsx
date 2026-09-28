import React, {useEffect, useRef, useState} from 'react';
import "../styles/SampleSidebar.css";
export default function SampleSidebar({
                                          samples,
                                          duplicateSample,
                                          deleteSample,
                                          selectedId,
                                          onSelect,
                                          onUpload,
                                          onPlaySolo,
                                          onStopSolo,
                                          onVolumeChange,
                                          isRecording,
                                          onToggleRecording,
                                      }) {
    const [expandedParents, setExpandedParents] = useState({});
    const [playingIds, setPlayingIds] = useState({});
    const [multiSelected, setMultiSelected] = useState([]);
    const timersRef = useRef({});
    const prevSamplesRef = useRef(samples);

    useEffect(() => {
        if (selectedId && !multiSelected.includes(selectedId)) {
            setMultiSelected([selectedId]);
        }
    }, [selectedId]);

    useEffect(() => {
        const prevSamples = prevSamplesRef.current;
        if (samples.length > prevSamples.length) {
            const newSamples = samples.filter(s => !prevSamples.find(p => p.id === s.id));
            const updates = {};
            newSamples.forEach(s => {
                if (s.parentId) updates[s.parentId] = true;
            });
            if (Object.keys(updates).length > 0) {
                setExpandedParents(prev => ({ ...prev, ...updates }));
            }
        }
        prevSamplesRef.current = samples;
    }, [samples]);

    const handleItemSelect = (id, e) => {
        if (e.shiftKey) {
            e.preventDefault();
            setMultiSelected(prev => {
                if (prev.includes(id)) return prev.filter(x => x !== id);
                return [...prev, id];
            });
        } else {
            setMultiSelected([id]);
            onSelect(id);
        }
    };

    const handleVolumeChange = (id, val) => {
        const idsToUpdate = multiSelected.includes(id) ? multiSelected : [id];
        onVolumeChange(idsToUpdate, val);
    };


    const handlePreviewClick = (sample, e) => {
        e.stopPropagation();
        if (playingIds[sample.id]) {
            if (onStopSolo) onStopSolo(sample.id);
            clearTimeout(timersRef.current[sample.id]);
            setPlayingIds(prev => ({ ...prev, [sample.id]: false }));
        } else {
            onPlaySolo(sample.id);
            setPlayingIds(prev => ({ ...prev, [sample.id]: true }));

            const startMs = sample.startTime || 0;
            let endMs = sample.endTime;
            if (endMs === undefined || endMs === null) {
                endMs = sample.buffer ? sample.buffer.duration * 1000 : 1000;
            }

            const durationMs = Math.max(50, endMs - startMs);

            clearTimeout(timersRef.current[sample.id]);
            timersRef.current[sample.id] = setTimeout(() => {
                setPlayingIds(prev => ({ ...prev, [sample.id]: false }));
                if (onStopSolo) onStopSolo(sample.id);
            }, durationMs);
        }
    };


    const toggleExpand = (parentId) => {
        setExpandedParents(prev => ({
            ...prev,
            [parentId]: !prev[parentId]
        }));
    };

    const parents = samples.filter(s => !s.parentId);

    return (
        <div className="sample-sidebar">
            <div style={{
                padding: '10px 0',
                textAlign: 'center',
                display: 'flex',
                gap: '10px',
                justifyContent: 'center'
            }}>
                <input
                    type="file"
                    onChange={onUpload}
                    accept="audio/*"
                    id="upload-input"
                    style={{display: 'none'}}
                />
                <label
                    htmlFor="upload-input"
                    className="settings-btn"
                    style={{border: '1px solid #f1ad36', cursor: 'pointer', display: 'block', flex: 1}}
                >
                    + UPLOAD SAMPLE
                </label>
                <button
                    className="settings-btn"
                    style={{
                        flex: 1,
                        border: `1px solid ${isRecording ? '#ff4444' : '#f1ad36'}`,
                        backgroundColor: isRecording ? 'rgba(255, 68, 68, 0.2)' : 'transparent',
                        color: isRecording ? '#ff4444' : '#fff',
                        cursor: 'pointer'
                    }}
                    onClick={onToggleRecording}
                >
                    {isRecording ? '■ STOP REC' : '● REC SAMPLE'}
                </button>
            </div>

            <div className="sample-list">
                {parents.map(parent => {
                    const childSlices = samples
                        .filter(s => s.parentId === parent.id)
                        .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

                    const isExpanded = expandedParents[parent.id];

                    return (
                        <React.Fragment key={parent.id}>
                            <div
                                className={`sample-item ${multiSelected.includes(parent.id) ? 'active' : ''}`}
                                onClick={(e) => handleItemSelect(parent.id, e)}
                                style={{borderLeft: `6px solid ${parent.color || '#f1ad36'}`, display: 'flex', alignItems: 'center'}}
                            >
                                <div className="sample-name" style={{flex: 1}}>1. {parent.name}</div>

                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={parent.volume !== undefined ? parent.volume : 100}
                                    onChange={(e) => handleVolumeChange(parent.id, Number(e.target.value))}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ width: '50px', margin: '0 10px' }}
                                    title="Volume"
                                />

                                <div className="sample-options" onClick={e => e.stopPropagation()}>
                                    <button
                                        className="preview-btn"
                                        style={{display: 'block'}}
                                        onClick={(e) => handlePreviewClick(parent, e)}
                                    >
                                        {playingIds[parent.id] ? '⏸' : '▶'}
                                    </button>
                                    <button
                                        className="duplicate-btn"
                                        onClick={() => duplicateSample(parent.id)}
                                    >
                                        +
                                    </button>
                                    <button
                                        className="settings-btn"
                                        style={{
                                            background: 'transparent',
                                            display: 'block',
                                            padding: '5px',
                                            color: '#ff4444',
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => deleteSample(parent.id)}
                                    >
                                        ×
                                    </button>
                                    {childSlices.length > 0 && (
                                        <button
                                            onClick={() => toggleExpand(parent.id)}
                                            className="settings-btn"
                                            style={{
                                                border: 'none',
                                                background: 'transparent',
                                                display: 'block',
                                                padding: '0 5px'
                                            }}
                                        >
                                            {isExpanded ? '▼' : '▶'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {isExpanded && childSlices.map((slice, index) => (
                                <div
                                    key={slice.id}
                                    className={`sample-item slice-item ${multiSelected.includes(slice.id) ? 'active' : ''}`}
                                    onClick={(e) => handleItemSelect(slice.id, e)}
                                    style={{
                                        paddingLeft: '25px',
                                        borderLeft: `6px solid ${slice.color || parent.color || '#f1ad36'}`,
                                        backgroundColor: 'rgba(255, 165, 0, 0.05)',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div className="sample-name" style={{flex: 1}}>{index + 2}. {slice.name}</div>

                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={slice.volume !== undefined ? slice.volume : 100}
                                        onChange={(e) => handleVolumeChange(slice.id, Number(e.target.value))}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ width: '50px', margin: '0 10px' }}
                                        title="Volume"
                                    />

                                    <div className="sample-options" onClick={e => e.stopPropagation()}>
                                        <button
                                            className="preview-btn"
                                            style={{display: 'block'}}
                                            onClick={(e) => handlePreviewClick(slice, e)}
                                        >
                                            {playingIds[slice.id] ? '⏸' : '▶'}
                                        </button>
                                        <button
                                            className="duplicate-btn"
                                            onClick={() => duplicateSample(slice.id)}
                                        >
                                            +
                                        </button>
                                        <button
                                            className="settings-btn"
                                            style={{
                                                background: 'transparent',
                                                display: 'block',
                                                padding: '5px',
                                                color: '#ff4444',
                                                border: 'none',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => deleteSample(slice.id)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}