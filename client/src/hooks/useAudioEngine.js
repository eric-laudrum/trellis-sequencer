import { useEffect, useRef } from "react";
import * as Tone from "tone";

export const useAudioEngine = (bpm, numBars, isPlaying, gridRef, triggerSample, setActiveStep, rows, cols) => {
    const transport = Tone.getTransport();

    // BPM Control
    useEffect(() => {
        if (Number.isFinite(bpm) && bpm > 0) {
            transport.bpm.rampTo(bpm, 0.1);
        }
    }, [bpm]);

    // Sequence
    useEffect(() => {

        if (!isPlaying) {
            transport.stop();
            transport.seconds = 0;
            setActiveStep(-1);
            return;
        }

        const stepsPerBar = rows * cols;
        const totalSteps = stepsPerBar * numBars;

        const seq = new Tone.Sequence((time, stepIdx) => {
            const currentBar = Math.floor(stepIdx / stepsPerBar);
            const stepInBar = stepIdx % stepsPerBar;

            const col = stepInBar % cols;
            const standardRow = Math.floor(stepInBar / cols);
            const flippedRow = (rows - 1) - standardRow;

            const gridIndex = (currentBar * stepsPerBar) + (flippedRow * cols) + col;

            Tone.Draw.schedule(() => setActiveStep(gridIndex), time);

            const cell = gridRef.current[gridIndex];
            if (cell?.isActive && cell.sampleId) {
                triggerSample(cell.sampleId, time);
            }
        }, Array.from({ length: totalSteps }, (_, i) => i), "8n");

        transport.start();
        seq.start(0);

        return () => seq.dispose();
    }, [numBars, isPlaying, rows, cols]);
};