import { useEffect, useRef } from "react";
import * as Tone from "tone";

export const useAudioEngine = (bpm, numBars, isPlaying, gridRef, triggerSample, setActiveStep) => {
    const transport = Tone.getTransport();

    // BPM Control
    useEffect(() => {
        if (Number.isFinite(bpm) && bpm > 0) {
            transport.bpm.rampTo(bpm, 0.1);
        }
    }, [bpm]);

    // Sequence
    useEffect(() => {
        const stepsPerBar = 16;
        const totalSteps = stepsPerBar * numBars;

        const seq = new Tone.Sequence((time, stepIdx) => {
            const stepsPerBar = rows * cols;
            const currentBar = Math.floor(stepIdx / stepsPerBar);
            const stepInBar = stepIdx % stepsPerBar;

            const col = stepInBar % cols;
            const standardRow = Math.floor(stepInBar / cols);
            const flippedRow = (rows - 1) - standardRow; // Keeps your bottom-up layout

            const gridIndex = (currentBar * stepsPerBar) + (flippedRow * cols) + col;

            Tone.Draw.schedule(() => setActiveStep(gridIndex), time);

            const cell = gridRef.current[gridIndex];
            if (cell?.isActive && cell.sampleId) {
                triggerSample(cell.sampleId, time);
            }
        }, Array.from({ length: 16 * numBars }, (_, i) => i), "8n");

        if (isPlaying) {
            if (Tone.getContext().state !== 'running') Tone.start();
            transport.start();
            seq.start(0);
        } else {
            transport.stop();
            transport.seconds = 0;
            seq.stop();
        }

        return () => seq.dispose();
    }, [numBars, isPlaying]); // Only re-run if bars or play/pause changes
};