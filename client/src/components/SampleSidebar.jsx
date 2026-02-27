const SampleSidebar = ({ samples, selectedId, onSelect, onUpload }) => {
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
                        key={ sample.id}
                        className={`sample-item ${selectedId === sample.id ? 'active' : ''}`}
                        onClick={() => onSelect(sample.id)}
                    >
                        <span>{ sample.name}</span>
                        <span>{ sample.startTime.toFixed(2)}s</span>
                    </div>
                ))}
            </div>

        </aside>
    )
};

export default SampleSidebar;