/*

    Sample Library

*/


const SampleSidebar = ({
    samples =[],
    duplicateSample,
    selectedId,
    onSelect,
    onUpload,
    onPlaySolo,
    onSetChokeGroup,
    onSetColor,
 }) => {

    return(

        <aside className="sample-sidebar">
            <h3 id="library-title">Library</h3>

            <div className="upload-wrapper">
                <input type="file"
                       accept="audio/*"
                       onChange={onUpload}
                />

            </div>


            <div className="sample-list">
                {samples.map((sample, index) => (
                    
                    <div
                        key={sample.id}
                        className={`sample-item ${selectedId === sample.id ? 'active' : ''}`}
                        onClick={() => onSelect(sample.id)}
                        style={{ 
                            // Force the border to match the sample's color
                            borderLeft: `6px solid ${sample.color || 'var(--primary)'}`,
                            backgroundColor: selectedId === sample.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                        }}
                    >


                        {/* Sample name */}
                        <div className="sample-info">
                            <span className="sample-name">{sample.name}</span>
                        </div>

                        {/* Sample options */}
                        <div className="sample-options">


                            <input 
                                type="color" 
                                value={sample.color || '#f1ad36'} 
                                onChange={(e) => onSetColor(sample.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="color-picker-mini"
                            />

                            {/* Choke group */}
                            <select 
                                className="group-select"
                                value={sample.chokeGroup ?? "none"}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    onSetChokeGroup(sample.id, e.target.value);
                                }}
                            >
                                <option value="none">-</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                            </select>

                            {/* Duplication Button */}
                            <button
                                className="duplicate-btn"
                                title="Duplicate Sample"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    duplicateSample(sample.id);
                                }}
                            >
                            +
                            </button>
                        </div>
                    </div>
                ))}
            </div>

        </aside>
    )
};

export default SampleSidebar;