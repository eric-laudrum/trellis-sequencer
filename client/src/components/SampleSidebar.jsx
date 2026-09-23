import React, { useState } from 'react';
import "../styles/SampleSidebar.css";
export default function SampleSidebar({
    samples,
    duplicateSample,
    deleteSample,
    selectedId,
    onSelect,
    onUpload,
    onPlaySolo,
    isRecording,
    onToggleRecording,
    }) {
    const [expandedParents, setExpandedParents] = useState({});

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
                                className={`sample-item ${selectedId === parent.id ? 'active' : ''}`}
                                onClick={() => onSelect(parent.id)}
                                style={{borderLeft: `6px solid ${parent.color || '#f1ad36'}`}}
                            >
                                <div className="sample-name">1. {parent.name}</div>

                                <div className="sample-options" onClick={e => e.stopPropagation()}>
                                    <button
                                        className="preview-btn"
                                        style={{display: 'block'}}
                                        onClick={() => onPlaySolo(parent.id)}
                                    >
                                        ▶
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
                                    className={`sample-item slice-item ${selectedId === slice.id ? 'active' : ''}`}
                                    onClick={() => onSelect(slice.id)}
                                    style={{
                                        paddingLeft: '25px',
                                        borderLeft: `6px solid ${slice.color || parent.color || '#f1ad36'}`,
                                        backgroundColor: 'rgba(255, 165, 0, 0.05)'
                                    }}
                                >
                                    <div className="sample-name">{index + 2}. {slice.name}</div>
                                    <div className="sample-options" onClick={e => e.stopPropagation()}>
                                        <button
                                            className="preview-btn"
                                            style={{display: 'block'}}
                                            onClick={() => onPlaySolo(slice.id)}
                                        >
                                            ▶
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