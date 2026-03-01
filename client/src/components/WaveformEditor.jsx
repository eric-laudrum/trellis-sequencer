import React, { useRef, useEffect } from 'react';

const WaveformEditor = ({ buffer, startTime, onUpdateStart }) => {
    const canvasRef = useRef(null);

    useEffect(()=>{
        if(!buffer || !canvasRef.current){
            return
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d'); // Raw PCM data
        const data = buffer.getChannelData(0);
        const step = Math.ceil(data.length  / canvas.width );
        const amp = canvas.height / 2;

        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#00ffcc';
        ctx.beginPath();

        for( let i=0; i < canvas.width; i++ ){
            let min = 1.0;
            let max = -1.0;
            for (let j=0; j < step; j++){
                const datum = data[(i * step) + j];
                if(datum < min) min = datum;
                if(datum > max) max = datum;
            }
            ctx.lineTo(i, ( 1 + min) * amp);
            ctx.lineTo(i, ( 1 + max) * amp);
        }
        ctx.stroke();
    }, [buffer]);

    const handleMounse = (e) =>{
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.witdth;
        const newTimeInSeconds = percentage * buffer.duration;
        onUpdateStart( newTimeInSeconds * 1000 );
    };

    return(

        <div className="waveform-container">
            <canvas
                ref={canvasRef}
                width={600} height={150}
                onMouseDown={handleMounse}
                style={{ cursor: 'crosshair', display: 'block' }}
            />

            <div className='waveform' style={{
                position: 'absolute',
                top: 0,
                left: `${(startTime / (buffer.duration * 1000)) * 100}%`,
                width: '2px',
                height: '100%',
                backgroundColor: 'red',
                pointerEvents: 'none'
            }} />
        </div>
    );
};