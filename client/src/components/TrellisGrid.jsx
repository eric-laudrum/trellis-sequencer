import React, {useRef, useState} from 'react';
import '../styles/TrellisGrid.css';

const TrellisGrid = ({ gridState, onToggle, activeStep, padCount, samples, selectedFamilyId, onSetHold, onMovePad }) => {
    const cols = Math.sqrt(padCount);
    const rows = cols;

    const [dragStartIdx, setDragStartIdx] = useState(null);
    const [dragEnterIdx, setDragEnterIdx] = useState(null);
    const [dragMode, setDragMode] = useState(null);
    const gridRef = useRef(null);

    const getSeqStep = (idx) => {
        const col = idx % cols;
        const domRow = Math.floor(idx / cols);
        const seqRow = (rows - 1) - domRow;
        return (seqRow * cols) + col;
    };

    const getDomIdx = (seqStep) => {
        const col = seqStep % cols;
        const seqRow = Math.floor(seqStep / cols);
        const domRow = (rows - 1) - seqRow;
        return (domRow * cols) + col;
    };

    const holdsToDraw = [];

    if (selectedFamilyId) {
        gridState.forEach((cell, startIdx) => {
            const holdEnd = cell.holds?.[selectedFamilyId];
            if (holdEnd !== undefined && getSeqStep(holdEnd) > getSeqStep(startIdx)) {
                const startSampleId = cell.sampleIds?.find(id => samples.find(x => x.id === id && (x.id === selectedFamilyId || x.parentId === selectedFamilyId)));
                const startSample = samples.find(s => s.id === startSampleId);

                holdsToDraw.push({
                    start: startIdx,
                    end: holdEnd,
                    color: startSample?.color || '#fff',
                    isPreview: false
                });
            }
        });
    }

    if (dragMode === 'hold' && dragStartIdx !== null && dragEnterIdx !== null && getSeqStep(dragEnterIdx) > getSeqStep(dragStartIdx)) {
        const cell = gridState[dragStartIdx];
        const startSampleId = cell?.sampleIds?.find(id => samples.find(x => x.id === id && (x.id === selectedFamilyId || x.parentId === selectedFamilyId)));
        const startSample = samples.find(s => s.id === startSampleId);

        holdsToDraw.push({
            start: dragStartIdx,
            end: dragEnterIdx,
            color: startSample?.color || '#fff',
            isPreview: true
        });
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>

            {/* SVG Layer: Standard row calculation to match DOM layout */}
            <svg
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 5
                }}
            >
                {holdsToDraw.map((hold, idx) => {
                    const lines = [];
                    const startSeq = getSeqStep(hold.start);
                    const endSeq = getSeqStep(hold.end);

                    for (let s = startSeq; s < endSeq; s++) {
                        const p1 = getDomIdx(s);
                        const p2 = getDomIdx(s + 1);

                        const col1 = p1 % cols;
                        const col2 = p2 % cols;
                        const row1 = Math.floor(p1 / cols);
                        const row2 = Math.floor(p2 / cols);

                        const x1 = (col1 + 0.5) * (100 / cols);
                        const y1 = (row1 + 0.5) * (100 / rows);
                        const x2 = (col2 + 0.5) * (100 / cols);
                        const y2 = (row2 + 0.5) * (100 / rows);

                        lines.push(
                            <line
                                key={`${idx}-${s}`}
                                x1={`${x1}%`} y1={`${y1}%`}
                                x2={`${x2}%`} y2={`${y2}%`}
                                stroke={hold.color}
                                strokeWidth="10"
                                strokeLinecap="round"
                                opacity={hold.isPreview ? 0.5 : 0.8}
                            />
                        );
                    }
                    return lines;
                })}
            </svg>

            <div
                className="grid-viewport"
                style={{
                    position: 'relative',
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
                        const isHoldSample = isPadActive && familySamples[0]?.playbackMode === 'hold';
                        const isStartPad = holdsToDraw.some(h => h.start === i);

                        const bgStyle = isPadActive ? familySamples[0].color || '#f5820a' : '';

                        return (
                            <div
                                key={i}
                                draggable={isPadActive}
                                onDragStart={(e) => {
                                    setDragStartIdx(i);

                                    const transparentImg = new Image();
                                    transparentImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                                    e.dataTransfer.setDragImage(transparentImg, 0, 0);

                                    if (isHoldSample && !e.shiftKey) {
                                        setDragMode('hold');
                                        e.dataTransfer.setData('text/plain', 'hold');
                                        e.dataTransfer.effectAllowed = 'copy';
                                    } else {
                                        setDragMode('move');
                                        e.dataTransfer.setData('text/plain', i.toString());
                                        e.dataTransfer.effectAllowed = 'move';
                                    }
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragEnterIdx(prev => {
                                        if (prev !== i && getSeqStep(i) >= getSeqStep(dragStartIdx)) return i;
                                        return prev;
                                    });
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const transferData = e.dataTransfer.getData('text/plain');

                                    if (transferData === 'hold') {
                                        if (dragStartIdx !== null && getSeqStep(i) > getSeqStep(dragStartIdx)) {
                                            if (selectedFamilyId) onSetHold(dragStartIdx, i, selectedFamilyId);
                                        }
                                    } else if (transferData !== '') {
                                        const sourceIndex = parseInt(transferData, 10);
                                        if (!isNaN(sourceIndex) && sourceIndex !== i) {
                                            onMovePad(sourceIndex, i);
                                        }
                                    }

                                    setDragStartIdx(null);
                                    setDragEnterIdx(null);
                                    setDragMode(null);
                                }}
                                onDragEnd={() => {
                                    setDragStartIdx(null);
                                    setDragEnterIdx(null);
                                    setDragMode(null);
                                }}
                                className={`pad ${isPadActive ? 'active' : ''} ${isPlaying ? 'playing' : ''}`}
                                style={{
                                    position: 'relative',
                                    zIndex: isStartPad ? 10 : 1,
                                    ...(bgStyle ? {background: bgStyle} : {})
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
                                        <span key={idx} className="sample-name"

                                              style={{fontSize: '1.2rem', fontWeight: 'bold', pointerEvents: 'none'}}>
                                        {sampleNumber}
                                    </span>
                                    );
                                })}
                            </div>
                        );
                })}
            </div>
        </div>
    );
};

export default TrellisGrid;