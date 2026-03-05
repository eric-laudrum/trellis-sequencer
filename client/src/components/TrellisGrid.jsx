import React from 'react';
import './TrellisGrid.css'

const TrellisGrid = ({ gridState, onToggle, activeStep }) => {

    const physicalPadCount = 16;

    return (
        <div className="grid-viewport">
            {gridState.map((cell, i) => {

                const isPlaying = (activeStep % physicalPadCount) === i;

                return (
                    <button
                        key={i}
                        onClick={() => onToggle(i)}
                        className={`pad ${cell.isActive ? 'active' : ''} ${isPlaying ? 'playing' : ''}`}
                    />
                );
            })}
        </div>
    );
};

export default TrellisGrid;