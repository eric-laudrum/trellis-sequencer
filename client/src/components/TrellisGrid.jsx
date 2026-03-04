import React from 'react';
import './TrellisGrid.css'

const TrellisGrid = ({ gridState, onToggle, activeStep }) => {

    console.log( "on step ", activeStep);

    return(

        <div className="grid-container">

            {gridState.map((cell, i) => (
                <button
                    key={i}
                    onClick={() => onToggle(i)}
                    className={`pad ${cell.isActive ? 'active' : ''} ${activeStep === i ? 'playing' : ''}`}
                />
            ))}
        </div>
    );
};


export default TrellisGrid;