import React, {useRef, useEffect, useState} from 'react';
import * as Tone from 'tone';

const WaveformEditor = ({ buffer, startTime, onUpdateStart, isPlaying, lastTriggerTime }) => {
    const canvasRef = useRef(null);
    const [ playheadPosition, setPlayheadPosition ] = useState(0);

    // Draw waveform
    useEffect(()=>{
        if(!buffer || !canvasRef.current){
            return
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d'); // Raw PCM data
        const data = buffer.getChannelData(0);
        const step = Math.ceil(data.length  / canvas.width );
        const amp = canvas.height / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(241,173,54,0.78)';


        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 1;
        ctx.beginPath();

        for( let i=0; i < canvas.width; i++ ){
            let min = 1.0;
            let max = -1.0;
            for (let j=0; j < step; j++){
                const datum = data[(i * step) + j];
                if(datum < min) min = datum;
                if(datum > max) max = datum;
            }
            ctx.moveTo(i, ( 1 + min) * amp);
            ctx.lineTo(i, ( 1 + max) * amp);
        }
        ctx.stroke();
    }, [buffer]);


    // Update playhead
    useEffect(() => {
        let animId;
        const updatePlayhead = () => {


            // Get current time from clocks:
            // Transport (Sequencer Clock)
            const transportTime = Tone.getTransport().seconds;
            // Context (Manual Play Clock)
            const contextTime = Tone.now();

            // Select clock based on sound origin
            const currentTime = isPlaying ? transportTime : contextTime;

            const timeElapsed = currentTime - lastTriggerTime;
            const isCurrentlyPlaying = buffer && timeElapsed >= 0 && timeElapsed <= buffer.duration;

            if (buffer && lastTriggerTime > 0 && (isPlaying || isCurrentlyPlaying)) {
                const startInSeconds = startTime / 1000;
                const currentPosition = startInSeconds + Math.max(0, timeElapsed);

                // Get progress as ratio
                const progress = Math.min(currentPosition / buffer.duration, 1);
                setPlayheadPosition(progress * 100);

                // Reset if finished and looping
                if (progress >= 1 && !isPlaying) {
                    const initialPercent = ( startTime / ( buffer.duration * 1000 )) * 100;
                    setPlayheadPosition(initialPercent);
                }
            } else {
                const initialPercent = ( startTime / ( buffer.duration * 1000 )) * 100;
                setPlayheadPosition(initialPercent);
            }

            animId = requestAnimationFrame(updatePlayhead);
        };

        updatePlayhead();

        return () => cancelAnimationFrame(animId);

    }, [isPlaying, buffer, lastTriggerTime, startTime]);


    const handleMouse = (e) => {
        if (!buffer) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const newTimeInSeconds = percentage * buffer.duration;
        onUpdateStart(newTimeInSeconds * 1000);
    };

    return(

        <div className="waveform-container">
            <canvas
                ref={canvasRef}
                width={600}
                height={150}
                onMouseDown={handleMouse}
            />

            {/* Red Start Line */}
            <div className="marker"
                 style={{
                     left: `${Math.min(100, Math.max(0, (startTime / (buffer.duration * 1000)) * 100))}%`,
                     backgroundColor: 'red',
                 }}
            />

            {/* White Playhead */}
            <div className="marker"
                style={{
                    left: `${playheadPosition}%`,
                    backgroundColor: 'white',
                    opacity: (isPlaying || playheadPosition > (startTime / (buffer.duration * 10)) + 0.5) ? 1 : 0,
                    boxShadow: '0 0 5px white',
                    zIndex: 11,
                    width: '2px',
                    position: 'absolute',
                    top: 0,
                    bottom: 0
                }}
            />

        </div>
    );
};

export default WaveformEditor;