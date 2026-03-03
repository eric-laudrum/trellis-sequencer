// hooks/useSequencer.js
import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';

export const useSequencer = (gridState, socket, rows = 4, cols = 4) => {
    const [samples, setSamples] = useState([]);
    const [selectedSampleId, setSelectedSampleId] = useState(null);
    const [activeStep, setActiveStep] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [sampleStart, setSampleStart] = useState(0);
    const [lastTriggerTime, setLastTriggerTime] = useState(0);

    const players = useRef({});
    const gridRef = useRef(gridState);
    const tapTimes = useRef([]);
    const sampleRef = useRef([]);

    // Socket listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('update-transport', ({ isPlaying: remoteIsPlaying }) => {
            if (remoteIsPlaying) {
                Tone.Transport.start();
                setIsPlaying(true);
            } else {
                Tone.Transport.stop();
                Tone.Transport.seconds = 0;
                setIsPlaying(false);
                setActiveStep(-1);
            }
        });

        socket.on('update-bpm', (newBpm) => {
            setBpm(newBpm);
        });

        return () => {
            socket.off('update-transport');
            socket.off('update-bpm');
        };
    }, [socket]);

    // Handlers
    const togglePlayback = useCallback(async () => {
        if (Tone.getContext().state !== 'running') await Tone.start();

        const nextState = !isPlaying;

        // Update Local
        if (nextState) {
            Tone.Transport.start();
        } else {
            Tone.Transport.stop();
            Tone.Transport.seconds = 0;
            setActiveStep(-1);
        }
        setIsPlaying(nextState);

        // Update Global
        socket.emit('transport-toggle', { isPlaying: nextState });
    }, [isPlaying, socket]);

    const stopAll = () => {
        Tone.Transport.stop();
        Tone.Transport.seconds = 0;
        Object.values(players.current).forEach(p => p.stop());
        setIsPlaying(false);
        setActiveStep(-1);
        socket.emit('transport-toggle', { isPlaying: false });
    };

    // Core Logic
    const triggerSample = (sampleId, time) => {
        const player = players.current[sampleId];
        const currentSamples = sampleRef.current;
        const sampleData = currentSamples.find(s => s.id === sampleId);

        if (player?.loaded && sampleData) {
            // Choke Logic
            if (sampleData.chokeGroup !== null) {
                currentSamples.forEach(s => {
                    if (s.chokeGroup === sampleData.chokeGroup && s.id !== sampleId) {
                        players.current[s.id]?.stop(time);
                    }
                });
            }
            player.start(time, sampleData.startTime || 0);
            setLastTriggerTime(Tone.Transport.seconds);
        }
    };

    const loadFile = async (file) => {
        const id = crypto.randomUUID();
        const url = URL.createObjectURL(file);
        const newPlayer = new Tone.Player(url).toDestination();
        await newPlayer.load(url);
        players.current[id] = newPlayer;
        setSamples(prev => [...prev, { id, name: file.name, startTime: 0, buffer: newPlayer.buffer, chokeGroup: null }]);
        setSelectedSampleId(id);
    };

    // Update Refs
    useEffect(() => { sampleRef.current = samples; }, [samples]);
    useEffect(() => { gridRef.current = gridState; }, [gridState]);

    // Sync BPM
    useEffect(() => {
        Tone.Transport.bpm.value = bpm;
    }, [bpm]);

    // Sequence Generator
    useEffect(() => {
        const order = [];
        for (let r = rows - 1; r >= 0; r--) {
            for (let c = 0; c < cols; c++) order.push(r * cols + c);
        }

        const seq = new Tone.Sequence((time, stepIdx) => {
            const gridIndex = order[stepIdx];
            setActiveStep(gridIndex);

            const cell = gridRef.current[gridIndex];
            if (cell?.isActive && cell.sampleId) {
                triggerSample(cell.sampleId, time);
            }
        }, Array.from({ length: rows * cols }, (_, i) => i), "8n");

        seq.start(0);
        return () => seq.dispose();
    }, [rows, cols]);

    // BPM Math (Broadcasting)
    const updateBpmGlobal = (val) => {
        const clamped = Math.max(30, Math.min(300, val));
        setBpm(clamped);
        socket.emit('bpm-change', clamped);
    };

    return {
        activeStep, isPlaying, togglePlayback, stopAll,
        bpm, setBpm: updateBpmGlobal,
        sampleStart, samples, selectedSampleId, setSelectedSampleId,
        lastTriggerTime, setChokeGroup: (id, g) => setSamples(p => p.map(s => s.id === id ? {...s, chokeGroup: g === "none" ? null : parseInt(g)} : s)),

        tapBpm: () => {},
        doubleBpm: () => updateBpmGlobal(bpm * 2),
        halfBpm: () => updateBpmGlobal(bpm / 2),
        loadFile, playSampleSolo: (id) => triggerSample(id, Tone.now()),
        setSampleStart: (ms) => { setSampleStart(ms); if(selectedSampleId) setSamples(p => p.map(s => s.id === selectedSampleId ? {...s, startTime: ms/1000} : s)) }
    };
};