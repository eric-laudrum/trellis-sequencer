const SampleSidebar = ({ samples, selectedId, onSelect, onUpload, onPlaySolo, onSetChokeGroup }) => {
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

                        <div className="choke-selector">
                            <label>CHOKE</label>
                            <select
                                value={sample.chokeGroup ?? "none"}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    onSetChokeGroup(sample.id, e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <option value="none">Off</option>
                                <option value="1">Group 1</option>
                                <option value="2">Group 2</option>
                                <option value="3">Group 3</option>
                                <option value="4">Group 4</option>
                            </select>
                        </div>


                    </div>
                ))}
            </div>

        </aside>
    )
};

export default SampleSidebar;