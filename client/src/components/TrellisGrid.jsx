import React from 'react';
import './TrellisGrid.css';

const TrellisGrid = ({ gridState, onToggle, activeStep, padCount, samples, selectedFamilyId }) => {
    const cols = Math.sqrt(padCount);

    return (
        <div
            className="grid-viewport"
            style={{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${cols}, 1fr)`
            }}
        >
            {gridState.map((cell, i) => {
                const isPlaying = activeStep === i;

                const currentIds = cell.sampleIds || (cell.sampleId ? [cell.sampleId] : []);

                const familySamples = currentIds
                    .map(id => samples.find(s => s.id === id))
                    .filter(s => s && selectedFamilyId && (s.id === selectedFamilyId || s.parentId === selectedFamilyId));

                const isPadActive = cell.isActive && familySamples.length > 0;

                let bgStyle = '';
                if (isPadActive) {
                    bgStyle = familySamples[0].color || '#f5820a';
                }

                return (
                    <div
                        key={i}
                        className={`pad ${isPadActive ? 'active' : ''} ${isPlaying ? 'playing' : ''}`}
                        style={bgStyle ? { background: bgStyle } : {}}
                        onClick={() => onToggle(i)}
                    >
                        {familySamples.map((s, idx) => (
                            <span key={idx} className="sample-name">
                                {s.name}
                            </span>
                        ))}
                    </div>
                );
            })}
        </div>
    );
};

export default TrellisGrid;