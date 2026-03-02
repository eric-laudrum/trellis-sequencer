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


                        <div className="sample-options">

                            <div className="choke-selector">
                                <select className="group-select"
                                        value={sample.chokeGroup ?? "none"}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            onSetChokeGroup(sample.id, e.target.value);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                >
                                    <option value="none">-</option>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                </select>
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


                    </div>
                ))}
            </div>

        </aside>
    )
};

export default SampleSidebar;