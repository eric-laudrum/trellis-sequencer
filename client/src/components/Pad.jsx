// Pad.jsx
import React from 'react';

const Pad = ({ isActive, isHighlighted, sample, onClick }) => {
    return (
        <div
            onClick={onClick}
            className={`pad 
                ${isActive ? 'active' : 'inactive'} 
                ${isHighlighted ? 'playing' : ''}
          `}
        >
            {sample && <span className="sample-name">{sample.name}</span>}
        </div>
    );
};

export default Pad;