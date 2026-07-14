import React from 'react';
import Pad from './Pad.jsx'; // Make sure to import your Pad component
import './TrellisGrid.css'

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

                // Find the actual sample object based on the ID saved in the grid cell
                const matchedSample = samples.find(s => s.id === cell.sampleId);

                return (
                    <Pad
                        key={i}
                        isActive={cell.isActive}
                        isHighlighted={isPlaying}
                        sample={matchedSample}
                        onClick={() => onToggle(i)}
                    />
                );
            })}
        </div>
    );
};

export default TrellisGrid;