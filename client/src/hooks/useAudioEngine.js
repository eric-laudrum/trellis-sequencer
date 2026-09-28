import { useEffect } from "react";
import * as Tone from "tone";

export const useAudioEngine = (bpm, numBars, isPlaying, gridRef, triggerSample, setActiveStep, rows, cols, isLoopMode, loopRange) => {
    const transport = Tone.getTransport();

    useEffect(() => {
        if (Number.isFinite(bpm) && bpm > 0) {
            transport.bpm.rampTo(bpm, 0.1);
        }
    }, [bpm, transport]);

    useEffect(() => {
        if (!isPlaying) {
            transport.stop();
            transport.seconds = 0;
            setActiveStep(-1);
            return;
        }

        const stepsPerBar = rows * cols;
        const totalSteps = stepsPerBar * numBars;

        let stepArray = [];

        if (isLoopMode && loopRange && loopRange.length === 2) {
            const [startSeq, endSeq] = loopRange;
            for (let i = startSeq; i <= endSeq; i++) {
                stepArray.push(i);
            }
        } else {
            stepArray = Array.from({ length: totalSteps }, (_, i) => i);
        }

        if (stepArray.length === 0) return;

        const seq = new Tone.Sequence((time, stepIdx) => {
            const currentBar = Math.floor(stepIdx / stepsPerBar);
            const stepInBar = stepIdx % stepsPerBar;

            const col = stepInBar % cols;
            const standardRow = Math.floor(stepInBar / cols);
            const flippedRow = (rows - 1) - standardRow;

            const gridIndex = (currentBar * stepsPerBar) + (flippedRow * cols) + col;

            Tone.Draw.schedule(() => setActiveStep(gridIndex), time);

            const cell = gridRef.current[gridIndex];
            if (cell?.isActive) {
                const sampleIds = cell.sampleIds || (cell.sampleId ? [cell.sampleId] : []);
                if (sampleIds.length > 0) {
                    triggerSample(sampleIds, time, gridIndex);
                }
            }
        }, stepArray, "8n");

        transport.start();
        seq.start(0);

        return () => {
            seq.dispose();
        };
    }, [bpm, numBars, isPlaying, triggerSample, setActiveStep, rows, cols, isLoopMode, loopRange, transport, gridRef]);
};