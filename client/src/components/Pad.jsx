// Pad.jsx
import React from 'react';

const Pad = ({ isActive, isHighlighted, sample, onClick }) => {

    const padColor = sample?.color || 'var(--primary)';

    const padStyle = {
        backgroundColor: isActive ? padColor : 'var(--bg-dark)',
        boxShadow: isActive ? `0 0 15px ${padColor}` : 'none',
        borderColor: padColor,
        borderColor: padColor,
        borderWidth: '2px',
        borderStyle: 'solid',
        outline: isHighlighted ? `2px solid white` : 'none'
    };


    return (
        <div
            onClick={onClick}
            className={`pad ${isActive ? 'active' : 'inactive'} ${isHighlighted ? 'playing' : ''}`}
            style={padStyle}
        >
            {sample && <span className="sample-name-overlay">{sample.name}</span>}
        </div>
    );
};



export default Pad;