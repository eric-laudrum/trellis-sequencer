import React from 'react';
import './TrellisGrid.css'

const TrellisGrid = ({ gridState, onToggle }) => {

    return(
        <div className="grid-container">
            {gridState.map((isOn, i ) => (
                <button
                    key={i}
                    onClick={() => onToggle(i)}
                    className={`pad ${isOn ? 'active' : ''}`}
                />
            ))}
        </div>
    );
};




export default TrellisGrid;