import React, {useRef, useEffect, useState} from 'react';
import * as Tone from 'tone';

const WaveformEditor = ({ buffer, startTime, onUpdateStart, isPlaying, lastTriggerTime, lastTriggerRef }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Zoom
    const [zoomRange, setZoomRange] = useState({ start: 0, end: 1 });
    const [playheadPos, setPlayheadPos] = useState(0);
    const [isDraggingStart, setIsDraggingStart] = useState(false);

    // States for Zoom Selection Box
    const [selection, setSelection] = useState(null);

    // Draw waveform
    useEffect(() => {
        if (!buffer || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const data = buffer.getChannelData(0);

        const startIdx = Math.floor(zoomRange.start * data.length);
        const endIdx = Math.floor(zoomRange.end * data.length);
        const visibleData = data.slice(startIdx, endIdx);

        const step = Math.ceil(visibleData.length / canvas.width);
        const amp = canvas.height / 2;

        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#f1ad36';
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let i = 0; i < canvas.width; i++) {
            let min = 1.0, max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = visibleData[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            ctx.moveTo(i, (1 + min) * amp);
            ctx.lineTo(i, (1 + max) * amp);
        }
        ctx.stroke();
    }, [buffer, zoomRange]);


    // Update playhead
    useEffect(() => {
        let animId;
        const loop = () => {

            const triggerTime = (lastTriggerRef && lastTriggerRef.current) ? lastTriggerRef.current : lastTriggerTime;
            const now = Tone.now();
            const elapsed = now - lastTriggerTime;

            const isWithinSample = buffer && triggerTime > 0 && elapsed >= 0 && elapsed <= buffer.duration;

            if (isWithinSample) {
                const totalPercent = ((startTime / 1000) + elapsed) / buffer.duration;
                const visiblePercent = (totalPercent - zoomRange.start) / (zoomRange.end - zoomRange.start);

                // Only update if it's actually on screen
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
        loop();
        return () => cancelAnimationFrame(animId);
    }, [buffer, lastTriggerTime, lastTriggerRef, startTime, zoomRange]);

    // Drag logic
    const handleMouseDown = (e) => {
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;

        if (e.shiftKey) {
            setSelection({ startX: x, currentX: x });
        } else {
            setIsDraggingStart(true);
            updateStartFromMouse(x);
        }
    };

    const handleMouseMove = (e) => {
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));

        if (selection) {
            setSelection(prev => ({ ...prev, currentX: x }));
        } else if (isDraggingStart) {
            updateStartFromMouse(x);
        }
    };

    const handleMouseUp = () => {
        if (selection) {
            const rect = containerRef.current.getBoundingClientRect();
            const x1 = Math.min(selection.startX, selection.currentX) / rect.width;
            const x2 = Math.max(selection.startX, selection.currentX) / rect.width;

            if (x2 - x1 > 0.01) { // Min zoom threshold
                const newStart = zoomRange.start + x1 * (zoomRange.end - zoomRange.start);
                const newEnd = zoomRange.start + x2 * (zoomRange.end - zoomRange.start);
                setZoomRange({ start: newStart, end: newEnd });
            }
            setSelection(null);
        }
        setIsDraggingStart(false);
    };


    const updateStartFromMouse = (x) => {
        if (!buffer) return;
        const rect = containerRef.current.getBoundingClientRect();
        const percentOfCanvas = x / rect.width;
        const actualPercent = zoomRange.start + (percentOfCanvas * (zoomRange.end - zoomRange.start));
        onUpdateStart(actualPercent * buffer.duration * 1000);
    };

    const handleDoubleClick = () => setZoomRange({ start: 0, end: 1 });


    // Calculate Start Line position
    const startLinePos = buffer ?
        ((startTime / 1000 / buffer.duration) - zoomRange.start) / (zoomRange.end - zoomRange.start) * 100
        : 0;

    return (
        <div
            className="waveform-container"
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            style={{ overflow: 'hidden' }}
        >
            <canvas ref={canvasRef} width={600} height={120} />

            {/* Selection Box Overlay */}
            {selection && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: Math.min(selection.startX, selection.currentX),
                    width: Math.abs(selection.currentX - selection.startX),
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                    pointerEvents: 'none',
                    zIndex: 5
                }} />
            )}

            {/* Red Start Line */}
            <div style={{
                position: 'absolute',
                left: `${startLinePos}%`,
                top: 0,
                bottom: 0,
                width: '2px',
                backgroundColor: 'red',
                zIndex: 10,
                pointerEvents: 'none',
                boxShadow: '0 0 5px rgba(255,0,0,0.8)'
            }} />

            {/* White Playhead */}
            {playheadPos >= 0 && playheadPos <= 100 && (
                <div style={{
                    position: 'absolute',
                    left: `${playheadPos}%`,
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    backgroundColor: 'white',
                    zIndex: 11,
                    pointerEvents: 'none',
                    boxShadow: '0 0 10px white'
                }} />
            )}



        </div>
    );
};

export default WaveformEditor;