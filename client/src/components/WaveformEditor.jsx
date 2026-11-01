import React, { useRef, useEffect, useState } from 'react';
import * as Tone from 'tone';
import '../../src/styles/WaveformEditor.css';

const WaveformEditor = ({
                            buffer,
                            startTime,
                            endTime,
                            sliceMarkers = [],
                            onUpdateStart,
                            onUpdateEnd,
                            isPlaying,
                            lastTriggerTime,
                            lastTriggerRef,
                            editTool = 'cursor',
                            onSlice,
                            color
                        }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    const [zoomRange, setZoomRange] = useState({ start: 0, end: 1 });
    const [playheadPos, setPlayheadPos] = useState(0);
    const [isDraggingStart, setIsDraggingStart] = useState(false);
    const [isDraggingEnd, setIsDraggingEnd] = useState(false);
    const [selection, setSelection] = useState(null);
    const [hoverX, setHoverX] = useState(null); // Tracks mouse for scissors

    const [isPanning, setIsPanning] = useState(false);
    const [panStartX, setPanStartX] = useState(0);
    const [lastPanX, setLastPanX] = useState(0);
    const [panStartTime, setPanStartTime] = useState(0);

    // Waveform Drawing logic
    useEffect(() => {
        if (!buffer || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        let data;
        try {
            data = buffer.toArray ? buffer.toArray(0) : buffer.getChannelData(0);
        } catch (err) {
            console.error("[WAVEFORM] Could not extract audio data for drawing", err);
            return;
        }

        const startIdx = Math.floor(zoomRange.start * data.length);
        const endIdx = Math.floor(zoomRange.end * data.length);
        const visibleData = data.slice(startIdx, endIdx);

        const step = Math.max(1, Math.ceil(visibleData.length / canvas.width));
        const amp = canvas.height / 2;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = color || '#f1ad36';

        ctx.beginPath();
        ctx.lineWidth = 1.5;

        for (let i = 0; i < canvas.width; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = visibleData[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            ctx.moveTo(i, (1 + min) * amp);
            ctx.lineTo(i, (1 + max) * amp);
        }
        ctx.stroke();

        const startPct = (startTime / 1000) / buffer.duration;
        const endPct = (endTime / 1000) / buffer.duration;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';

        if (startPct > zoomRange.start) {
            const x = ((startPct - zoomRange.start) / (zoomRange.end - zoomRange.start)) * canvas.width;
            ctx.fillRect(0, 0, x, canvas.height);
        }

        if (endPct < zoomRange.end) {
            const x = ((endPct - zoomRange.start) / (zoomRange.end - zoomRange.start)) * canvas.width;
            ctx.fillRect(x, 0, canvas.width - x, canvas.height);
        }

    }, [buffer, zoomRange, startTime, endTime, color]);

    // Playhead logic
    useEffect(() => {
        if (!buffer || !lastTriggerRef) return;

        let animId;
        const loop = () => {
            const triggerData = lastTriggerRef.current;
            const triggerTime = triggerData?.time || 0;
            const triggerOffset = triggerData?.offset !== undefined ? triggerData.offset : (startTime / 1000);

            const now = Tone.now();
            const elapsed = now - triggerTime;

            if (triggerTime > 0 && elapsed >= 0 && elapsed <= buffer.duration) {
                const currentPlayTime = triggerOffset + elapsed;
                const totalPercent = currentPlayTime / buffer.duration;
                const visiblePercent = (totalPercent - zoomRange.start) / (zoomRange.end - zoomRange.start);

                if (visiblePercent >= 0 && visiblePercent <= 1) {
                    setPlayheadPos(visiblePercent * 100);
                } else {
                    setPlayheadPos(-1);
                }
            } else {
                setPlayheadPos(-1);
            }

            animId = requestAnimationFrame(loop);
        };

        animId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animId);
    }, [buffer, startTime, zoomRange, lastTriggerRef]);

    const getTimeFromMouse = (x) => {
        if (!buffer) return 0;
        const rect = containerRef.current.getBoundingClientRect();
        const percentOfCanvas = x / rect.width;
        const actualPercent = zoomRange.start + (percentOfCanvas * (zoomRange.end - zoomRange.start));
        return Math.max(0, Math.min(actualPercent * buffer.duration * 1000, buffer.duration * 1000));
    };

    const getPos = (time) => buffer ?
        ((time / 1000 / buffer.duration) - zoomRange.start) / (zoomRange.end - zoomRange.start) * 100
        : 0;

    const handleManualZoom = (factor) => {
        if (!buffer) return;

        const startMarkerPct = (startTime / 1000) / buffer.duration;
        const playheadActive = playheadPos >= 0 && playheadPos <= 100;

        const currentWidth = zoomRange.end - zoomRange.start;
        const newWidth = Math.max(0.001, Math.min(1, currentWidth * factor));

        let newStart, newEnd;

        if (playheadActive) {
            const anchorPct = zoomRange.start + (playheadPos / 100) * currentWidth;
            newStart = anchorPct - (newWidth / 2);
            newEnd = anchorPct + (newWidth / 2);
        } else {
            newStart = startMarkerPct - 0.01;
            newEnd = newStart + newWidth;
        }

        if (newStart < 0) {
            newEnd = Math.min(1, newEnd - newStart);
            newStart = 0;
        }
        if (newEnd > 1) {
            newStart = Math.max(0, newStart - (newEnd - 1));
            newEnd = 1;
        }

        setZoomRange({ start: newStart, end: newEnd });
    };

    const handleMouseDown = (e, hitRadius = 15) => {
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = e.clientX ?? e.touches?.[0].clientX;
        const x = clientX - rect.left;

        if (editTool === 'scissors') {
            if (onSlice) onSlice(getTimeFromMouse(x));
            return;
        }

        const sPos = (getPos(startTime) / 100) * rect.width;
        const ePos = (getPos(endTime) / 100) * rect.width;

        if (Math.abs(x - sPos) < hitRadius) setIsDraggingStart(true);
        else if (Math.abs(x - ePos) < hitRadius) setIsDraggingEnd(true);
        else if (e.shiftKey) setSelection({ startX: x, currentX: x });
        else {
            // Starts the tracking for a pan or a preview click
            setIsPanning(true);
            setPanStartX(clientX);
            setLastPanX(clientX);
            setPanStartTime(Date.now());
        }
    };

// 3. Update your Move Handler
    const handleMouseMove = (e) => {
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = e.clientX ?? e.touches?.[0].clientX;
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));

        if (editTool === 'scissors') {
            setHoverX(x);
            return;
        }

        const newTime = getTimeFromMouse(x);

        if (isDraggingStart) onUpdateStart(Math.min(newTime, endTime - 10));
        else if (isDraggingEnd) onUpdateEnd(Math.max(newTime, startTime + 10));
        else if (selection) setSelection(prev => ({ ...prev, currentX: x }));
        else if (isPanning) {
            const deltaX = clientX - lastPanX;
            setLastPanX(clientX);

            // Only slide the view if zoomed in
            if (zoomRange.end - zoomRange.start < 1) {
                const panPct = -(deltaX / rect.width) * (zoomRange.end - zoomRange.start);

                setZoomRange(prev => {
                    let newStart = prev.start + panPct;
                    let newEnd = prev.end + panPct;

                    // Stop at the edges
                    if (newStart < 0) { newEnd -= newStart; newStart = 0; }
                    if (newEnd > 1) { newStart -= (newEnd - 1); newEnd = 1; }

                    return { start: Math.max(0, newStart), end: Math.min(1, newEnd) };
                });
            }
        }
    };

// 4. Update your Up Handler
    const handleMouseUp = (e) => {
        // Safely pull coordinates from mouse or touch events
        let clientX = lastPanX;
        if (e?.clientX !== undefined) clientX = e.clientX;
        else if (e?.changedTouches) clientX = e.changedTouches[0].clientX;

        if (isPanning) {
            const dragDist = Math.abs(clientX - panStartX);
            const dragTime = Date.now() - panStartTime;

            // If they barely moved the mouse/finger and let go quickly, it's a tap preview
            if (dragDist < 5 && dragTime < 300 && onPreview) {
                const rect = containerRef.current.getBoundingClientRect();
                const clickX = clientX - rect.left;
                onPreview(getTimeFromMouse(clickX));
            }
            setIsPanning(false);
        }

        if (selection) {
            const rect = containerRef.current.getBoundingClientRect();
            const x1 = Math.min(selection.startX, selection.currentX) / rect.width;
            const x2 = Math.max(selection.startX, selection.currentX) / rect.width;
            if (x2 - x1 > 0.01) {
                const newStart = zoomRange.start + x1 * (zoomRange.end - zoomRange.start);
                const newEnd = zoomRange.start + x2 * (zoomRange.end - zoomRange.start);
                setZoomRange({ start: newStart, end: newEnd });
            }
            setSelection(null);
        }

        setIsDraggingStart(false);
        setIsDraggingEnd(false);
    };

    const handleTouchStart = (e) => {
        handleMouseDown({ clientX: e.touches[0].clientX, shiftKey: false }, 40);
    };

    const handleTouchMove = (e) => {
        handleMouseMove({ clientX: e.touches[0].clientX });
    };

    return (
        <div className="waveform-section">
            <div className="zoom-section">
                <button className='zoom-button' onClick={() => handleManualZoom(0.5)}>+</button>
                <button className='zoom-button' onClick={() => setZoomRange({ start: 0, end: 1 })}>Reset</button>
                <button className='zoom-button' onClick={() => handleManualZoom(2.0)}>-</button>
            </div>

            <div
                className="waveform-container"
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                    handleMouseUp();
                    setHoverX(null);
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseUp}
                onDoubleClick={() => setZoomRange({start: 0, end: 1})}
                style={{
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: editTool === 'scissors' ? 'crosshair' : 'ew-resize',
                    touchAction: 'none'
                }}
            >
                <canvas ref={canvasRef} width={600} height={120}/>

                {/* Draw all cuts/slices for this audio file */}
                {sliceMarkers.map((markTime, idx) => {

                    if (Math.abs(markTime - startTime) < 5) return null;
                    return (
                        <div key={`slice-${idx}`} style={{
                            position: 'absolute', left: `${getPos(markTime)}%`,
                            top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.4)',
                            zIndex: 10, pointerEvents: 'none'
                        }}/>
                    )
                })}

                {/* Scissors Preview Line */}
                {editTool === 'scissors' && hoverX !== null && (
                    <div style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: hoverX, width: '1px',
                        borderLeft: '2px dashed #f1ad36', zIndex: 15,
                        pointerEvents: 'none'
                    }}/>
                )}

                {selection && (
                    <div style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: Math.min(selection.startX, selection.currentX),
                        width: Math.abs(selection.currentX - selection.startX),
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.5)',
                        pointerEvents: 'none', zIndex: 5
                    }}/>
                )}

                {/* Active Sample Markers */}
                <div style={{
                    position: 'absolute', left: `${getPos(startTime)}%`,
                    top: 0, bottom: 0, width: '12px', zIndex: 20,
                    cursor: editTool === 'cursor' ? 'col-resize' : 'crosshair',
                    transform: 'translateX(-50%)', display: 'flex', justifyContent: 'center'
                }}>
                    <div style={{width: '4px', backgroundColor: 'red', height: '100%'}}/>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        backgroundColor: 'red',
                        color: 'white',
                        fontSize: '9px',
                        padding: '1px'
                    }}>S
                    </div>
                </div>

                <div style={{
                    position: 'absolute', left: `${getPos(endTime)}%`,
                    top: 0, bottom: 0, width: '12px', zIndex: 20,
                    cursor: editTool === 'cursor' ? 'col-resize' : 'crosshair',
                    transform: 'translateX(-50%)', display: 'flex', justifyContent: 'center'
                }}>
                    <div style={{width: '4px', backgroundColor: '#00ccff', height: '100%'}}/>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        backgroundColor: '#00ccff',
                        color: 'black',
                        fontSize: '9px',
                        padding: '1px'
                    }}>E
                    </div>
                </div>

                {playheadPos >= 0 && playheadPos <= 100 && (
                    <div style={{
                        position: 'absolute', left: `${playheadPos}%`,
                        top: 0, bottom: 0, width: '2px', backgroundColor: 'white',
                        zIndex: 11, pointerEvents: 'none', boxShadow: '0 0 10px white'
                    }}/>
                )}
            </div>
        </div>
    );
};

export default WaveformEditor;