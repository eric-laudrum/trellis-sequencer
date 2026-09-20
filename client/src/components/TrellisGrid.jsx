import React from 'react';
import './TrellisGrid.css';

const TrellisGrid = ({ gridState, onToggle, activeStep, padCount, samples }) => {
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
                const padSamples = currentIds.map(id => samples.find(s => s.id === id)).filter(Boolean);

                let bgStyle = '';
                if (cell.isActive && padSamples.length > 0) {
                    if (padSamples.length === 1) {
                        bgStyle = padSamples[0].color || '#f5820a';
                    } else if (padSamples.length === 2) {
                        const color1 = padSamples[0].color || '#f5820a';
                        const color2 = padSamples[1].color || '#f5820a';
                        bgStyle = `linear-gradient(135deg, ${color1} 50%, ${color2} 50%)`;
                    }
                }

                return (
                    <div
                        key={i}
                        className={`pad ${cell.isActive ? 'active' : ''} ${isPlaying ? 'playing' : ''}`}
                        style={{ background: bgStyle || undefined }}
                        onClick={() => onToggle(i)}
                    >
                        {padSamples.map((s, idx) => (
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