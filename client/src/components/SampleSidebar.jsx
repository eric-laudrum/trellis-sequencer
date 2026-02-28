const SampleSidebar = ({ samples, selectedId, onSelect, onUpload }) => {
    return(

        <aside className="library-container">
            <h3>Library</h3>
            <input type="file"
                   accept="audio/*"
                   onChange={ onUpload }
                   />

            <div className="sample-list">
                { samples.map((sample, index) => (
                    <div
                        key={ sample.id}
                        className={`sample-item ${selectedId === sample.id ? 'active' : ''}`}
                        onClick={() => onSelect(sample.id)}
                    >
                        <span className="sample-name">{ sample.name}</span>
                        <span className="sample-time">{ sample.startTime.toFixed(2)}s</span>
                    </div>
                ))}
            </div>

        </aside>
    )
};

export default SampleSidebar;