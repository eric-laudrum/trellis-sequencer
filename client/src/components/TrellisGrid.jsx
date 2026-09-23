import React, { useState } from 'react';
import '../styles/TrellisGrid.css';

const TrellisGrid = ({ gridState, onToggle, activeStep, padCount, samples, selectedFamilyId, onSetHold }) => {
    const cols = Math.sqrt(padCount);
    const [dragStartIdx, setDragStartIdx] = useState(null);
    const [dragEnterIdx, setDragEnterIdx] = useState(null);

    return (
        <div
            className="grid-viewport"
            style={{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${cols}, 1fr)`
            }}
        >
            {gridState.map((cell, i) => {
                const isPlaying = activeStep === i;
                const currentIds = cell.sampleIds || (cell.sampleId ? [cell.sampleId] : []);

                const familySamples = currentIds
                    .map(id => samples.find(s => s.id === id))
                    .filter(s => s && selectedFamilyId && (s.id === selectedFamilyId || s.parentId === selectedFamilyId));

                const isPadActive = cell.isActive && familySamples.length > 0;
                const canDragHold = isPadActive && familySamples[0]?.playbackMode === 'hold';
                const isRowEnd = (i + 1) % cols === 0;

                const activeHolds = [];

                if (selectedFamilyId) {
                    gridState.forEach((c, startIdx) => {
                        const holdEnd = c.holds?.[selectedFamilyId];
                        if (holdEnd !== undefined && holdEnd > startIdx) {
                            activeHolds.push({ start: startIdx, end: holdEnd });
                        }
                    });
                }
                if (dragStartIdx !== null && dragEnterIdx !== null && dragEnterIdx > dragStartIdx) {
                    activeHolds.push({ start: dragStartIdx, end: dragEnterIdx, isPreview: true });
                }

                let holdStyle = '';
                let holdLineColor = '#fff';
                const activeHold = activeHolds.find(h => i >= h.start && i <= h.end);

                if (activeHold) {
                    if (i === activeHold.start) holdStyle = 'hold-start';
                    else if (i === activeHold.end) holdStyle = 'hold-end';
                    else holdStyle = 'hold-mid';

                    if (activeHold.isPreview) holdStyle += ' preview';

                    const startCell = gridState[activeHold.start];
                    const startSampleId = startCell?.sampleIds?.find(id => samples.find(x => x.id === id && (x.id === selectedFamilyId || x.parentId === selectedFamilyId)));
                    const startSample = samples.find(s => s.id === startSampleId);
                    holdLineColor = startSample?.color || '#f5820a';
                }

                let bgStyle = '';
                if (isPadActive) {
                    bgStyle = familySamples[0].color || '#f5820a';
                } else if (holdStyle === 'hold-end') {
                    bgStyle = holdLineColor;
                }

                return (
                    <div
                        key={i}
                        draggable={canDragHold}
                        onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', '');
                            if (canDragHold) setDragStartIdx(i);
                        }}
                        onDragEnter={() => {
                            if (dragStartIdx !== null) setDragEnterIdx(i);
                        }}
                        onDragEnd={() => {
                            if (dragStartIdx !== null && dragEnterIdx !== null && dragEnterIdx >= dragStartIdx) {
                                if (selectedFamilyId) onSetHold(dragStartIdx, dragEnterIdx, selectedFamilyId);
                            }
                            setDragStartIdx(null);
                            setDragEnterIdx(null);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        className={`pad ${isPadActive || holdStyle === 'hold-end' ? 'active' : ''} ${isPlaying ? 'playing' : ''} ${holdStyle} ${isRowEnd ? 'row-end' : ''}`}
                        style={{
                            ...(bgStyle ? { background: bgStyle } : {}),
                            ...(activeHold ? { '--hold-color': holdLineColor } : {})
                        }}
                        onClick={() => onToggle(i)}
                    >
                        {familySamples.map((s, idx) => {
                            const familyId = s.parentId || s.id;
                            const parent = samples.find(x => x.id === familyId);
                            const children = samples
                                .filter(x => x.parentId === familyId)
                                .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
                            const fullFamily = parent ? [parent, ...children] : children;
                            const sampleNumber = fullFamily.findIndex(x => x.id === s.id) + 1;

                            return (
                                <span key={idx} className="sample-name" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                                    {sampleNumber}
                                </span>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
};

export default TrellisGrid;