const SampleSidebar = ({ samples, selectedId, onSelect, onUpload, onPlaySolo }) => {
    return(

        <aside className="sample-sidebar">
            <h3>Library</h3>
            <input type="file"
                   accept="audio/*"
                   onChange={ onUpload }
                   />

            <div className="sample-list">
                { samples.map((sample, index) => (
                    <div
                        key={sample.id}
                        className={`sample-item ${selectedId === sample.id ? 'active' : ''}`}
                        onClick={() => onSelect(sample.id)}
                    >

                        <div className="sample-info">
                            <span className="sample-name">{sample.name}</span>
                            <span className="sample-time">{sample.startTime.toFixed(2)}s</span>
                        </div>

                        <button
                            className="solo-play-btn"
                            onClick={(e) => {
                                e.stopPropagation(); // Prevents selecting the sample
                                onPlaySolo(sample.id);
                            }}
                        >
                            ▶
                        </button>


                    </div>
                ))}
            </div>

        </aside>
    )
};

export default SampleSidebar;