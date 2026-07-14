import React, { useState } from 'react';

const SampleSidebar = ({
                           samples = [],
                           duplicateSample,
                           selectedId,
                           onSelect,
                           onUpload,
                           onPlaySolo,
                           onSetChokeGroup,
                           onSetColor,
                       }) => {
    // Track which sample groups are expanded
    const [expandedGroups, setExpandedGroups] = useState({});

    const toggleGroup = (groupName, e) => {
        e.stopPropagation();
        setExpandedGroups(prev => ({
            ...prev,
            [groupName]: !prev[groupName]
        }));
    };

    // Group samples by their base name (e.g., "Break 2" belongs to "Break")
    const groupedSamples = samples.reduce((acc, sample) => {
        const match = sample.name.match(/^(.*?)(?: \d+)?$/);
        const baseName = match ? match[1] : sample.name;

        if (!acc[baseName]) {
            acc[baseName] = [];
        }
        acc[baseName].push(sample);
        return acc;
    }, {});

    return (
        <aside className="sample-sidebar">
            <h3 id="library-title">Library</h3>

            <div className="upload-wrapper">
                <input type="file" accept="audio/*" onChange={onUpload} />
            </div>

            <div className="sample-list">
                {Object.entries(groupedSamples).map(([baseName, group]) => {
                    const mainSample = group[0];
                    const hasDuplicates = group.length > 1;
                    const isExpanded = expandedGroups[baseName];

                    return (
                        <div key={baseName} className="sample-group">

                            {/* --- MAIN SAMPLE ROW --- */}
                            <div
                                className={`sample-item ${selectedId === mainSample.id ? 'active' : ''}`}
                                onClick={() => onSelect(mainSample.id)}
                                style={{
                                    borderLeft: `6px solid ${mainSample.color || 'var(--primary)'}`,
                                    backgroundColor: selectedId === mainSample.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                {/* Expand/Collapse Arrow */}
                                {hasDuplicates ? (
                                    <button
                                        onClick={(e) => toggleGroup(baseName, e)}
                                        style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', marginRight: '8px', fontSize: '12px', width: '15px' }}
                                    >
                                        {isExpanded ? '▼' : '▶'}
                                    </button>
                                ) : (
                                    <div style={{ width: '23px' }}></div> /* Spacer to keep alignment */
                                )}

                                <div className="sample-info" style={{ flexGrow: 1 }}>
                                    <span className="sample-name">{baseName}</span>
                                </div>

                                <div className="sample-options">
                                    <input
                                        type="color"
                                        value={mainSample.color || '#f1ad36'}
                                        onChange={(e) => onSetColor(mainSample.id, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="color-picker-mini"
                                    />

                                    <select
                                        className="group-select"
                                        value={mainSample.chokeGroup ?? "none"}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            onSetChokeGroup(mainSample.id, e.target.value);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <option value="none">-</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                    </select>

                                    {/* Sidebar Duplicate Button */}
                                    <button
                                        className="duplicate-btn"
                                        title="Duplicate Sample"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            duplicateSample(mainSample.id);
                                            setExpandedGroups(prev => ({ ...prev, [baseName]: true }));
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* --- DUPLICATES DROPDOWN --- */}
                            {isExpanded && hasDuplicates && (
                                <div className="sample-duplicates" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                                    {group.slice(1).map((subSample, index) => (
                                        <div
                                            key={subSample.id}
                                            className={`sample-item ${selectedId === subSample.id ? 'active' : ''}`}
                                            onClick={() => onSelect(subSample.id)}
                                            style={{
                                                borderLeft: `4px solid ${subSample.color || 'var(--primary)'}`,
                                                backgroundColor: selectedId === subSample.id ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                                paddingLeft: '35px', // Indent the duplicates
                                                display: 'flex',
                                                alignItems: 'center',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)'
                                            }}
                                        >
                                            <div className="sample-info" style={{ flexGrow: 1 }}>
                                                <span className="sample-name" style={{ fontSize: '0.9em', color: '#aaa' }}>
                                                    Slice {index + 1}
                                                </span>
                                            </div>

                                            <div className="sample-options">
                                                <button
                                                    className="duplicate-btn"
                                                    title="Duplicate This Slice"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        duplicateSample(subSample.id);
                                                    }}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
};

export default SampleSidebar;