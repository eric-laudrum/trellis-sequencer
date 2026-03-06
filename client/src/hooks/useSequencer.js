import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';
import { useSocketManager } from "./useSocketManager.js";
import { useAudioEngine } from "./useAudioEngine.js";

export const useSequencer = (gridState, socket, roomName, rows = 4, cols = 4) => {
    const [samples, setSamples] = useState([]);
    const [selectedSampleId, setSelectedSampleId] = useState(null);
    const [activeStep, setActiveStep] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [numBars, setNumBars] = useState(1);
    const [lastTriggerTime, setLastTriggerTime] = useState(0);

    const lastTriggerRef = useRef(0);
    const players = useRef({});
    const sampleRef = useRef([]);
    const transport = Tone.getTransport();
    const tapTimes = useRef([]);

    const [viewingBar, setViewingBar] = useState(0);
    const [isFollowEnabled, setIsFollowEnabled] = useState(true);

    // 1. Initialize Compartmentalized Logic
    const { shouldIgnoreServer, emitEvent } = useSocketManager(socket, roomName);

    const gridRef = useRef(gridState);
    useEffect(() => { gridRef.current = gridState; }, [gridState]);
    useEffect(() => { sampleRef.current = samples; }, [samples]);

    // 2. Sample Control Logic
    const setSampleStart = (sampleId, newStart) => {
        setSamples(prev => prev.map(s =>
            s.id === sampleId ? { ...s, startTime: newStart } : s
        ));
    };

    const setSampleEnd = (sampleId, newEnd) => {
        setSamples(prev => prev.map(s =>
            s.id === sampleId ? { ...s, endTime: newEnd } : s
        ));
    };

    const setChokeGroup = (sampleId, group) => {
        setSamples(prev => prev.map(sample =>
            sample.id === sampleId
                ? { ...sample, chokeGroup: group === 'none' ? null : group }
                : sample
        ));
    };

    const triggerSample = useCallback((sampleId, time) => {
        const player = players.current[sampleId];
        const sampleData = sampleRef.current.find(s => s.id === sampleId);

        if (player?.loaded && sampleData) {
            if (sampleData.chokeGroup && sampleData.chokeGroup !== 'none') {
                sampleRef.current.forEach(otherSample => {
                    if (otherSample.chokeGroup === sampleData.chokeGroup) {
                        players.current[otherSample.id]?.stop(time);
                    }
                });
            }

            const offset = (sampleData.startTime || 0) / 1000;
            const endTime = (sampleData.endTime || (player.buffer.duration * 1000)) / 1000;
            const duration = endTime - offset;

            player.start(time, offset, duration);
            lastTriggerRef.current = time;
            setLastTriggerTime(time);
        }
    }, []);

    const playSampleSolo = (id) => {
        const player = players.current[id];
        const sampleData = sampleRef.current.find(s => s.id === id);
        if (player?.loaded) {
            const now = Tone.now();
            player.start(now, (sampleData.startTime || 0) / 1000);
            lastTriggerRef.current = now;
            setLastTriggerTime(now);
        }
    };

    // 3. Audio Engine Orchestration (Kills the Freeze)
    useAudioEngine(bpm, numBars, isPlaying, gridRef, triggerSample, setActiveStep, rows, cols);

    // 4. BPM & Transport Actions (Kills the Jitter)
    const updateBpmGlobal = (val) => {
        const clamped = Math.max(30, Math.min(300, val));
        setBpm(clamped);
        emitEvent('bpm-change', clamped);
    };

    const tapBpm = () => {
        const now = Date.now();
        const newTapTimes = [...tapTimes.current, now].slice(-4);
        tapTimes.current = newTapTimes;

        if (newTapTimes.length > 1) {
            const avg = (newTapTimes[newTapTimes.length - 1] - newTapTimes[0]) / (newTapTimes.length - 1);
            const calculatedBpm = Math.round(60000 / avg);
            updateBpmGlobal(calculatedBpm);
        }
    };

    const togglePlayback = useCallback(async () => {
        if (Tone.getContext().state !== 'running') await Tone.start();
        const nextState = !isPlaying;
        setIsPlaying(nextState);
        emitEvent('transport-toggle', { isPlaying: nextState });
    }, [isPlaying, emitEvent]);

    const stopAll = () => {
        setIsPlaying(false);
        setActiveStep(-1);
        Object.values(players.current).forEach(p => p.stop());
        emitEvent('stop-all-audio');
    };

    // 5. Socket Sync (Respects the 3s Lock)
    useEffect(() => {
        if (!socket) return;

        socket.on('update-bpm', (newBpm) => {
            if (shouldIgnoreServer()) return;
            setBpm(newBpm);
        });

        socket.on('sync-entire-grid', ({ grid, numBars: remoteBars }) => {
            if (shouldIgnoreServer()) return;
            // Note: gridState is usually managed in StudioRoom, 
            // ensure StudioRoom's setGridState is synced if necessary.
            setNumBars(remoteBars);
        });

        socket.on('update-transport', ({ isPlaying: remoteIsPlaying }) => {
            setIsPlaying(remoteIsPlaying);
        });

        socket.on('initial-state', async (data) => {
            if (data.samples) {
                for (const s of data.samples) {
                    if (!players.current[s.id]) await addNewPlayer(s.id, s.url, s.name);
                }
            }
        });

        socket.on('kill-audio-instantly', () => {
            setIsPlaying(false);
            setActiveStep(-1);
            Object.values(players.current).forEach(p => p.stop());
        });

        return () => {
            socket.off('update-bpm');
            socket.off('sync-entire-grid');
            socket.off('update-transport');
            socket.off('initial-state');
            socket.off('kill-audio-instantly');
        };
    }, [socket, shouldIgnoreServer]);

    // 6. UI Helpers & Loading
    useEffect(() => {
        if (isFollowEnabled && activeStep !== -1) {
            const stepsPerBar = rows * cols;
            const playheadBar = Math.floor(activeStep / stepsPerBar);
            if (playheadBar !== viewingBar) setViewingBar(playheadBar);
        }
    }, [activeStep, isFollowEnabled, viewingBar, rows, cols]);

    const addNewPlayer = async (id, url, name) => {
        if (players.current[id]) return;
        try {
            const newPlayer = new Tone.Player().toDestination();
            await newPlayer.load(url);
            players.current[id] = newPlayer;
            setSamples(prev => [...prev, {
                id, name, url, buffer: newPlayer.buffer,
                startTime: 0, endTime: newPlayer.buffer.duration * 1000,
                chokeGroup: "none"
            }]);
        } catch (err) { console.error("Load failed:", url, err); }
    };

    const loadFile = async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await fetch(`${window.location.origin}/upload-sample`, { method: 'POST', body: formData });
            const { url, name } = await response.json();
            const id = crypto.randomUUID();
            await addNewPlayer(id, url, name);
            emitEvent('share-sample', { sampleData: { id, url, name } });
        } catch (err) { console.error("Upload error:", err); }
    };

    return {
        activeStep, viewingBar, setViewingBar, isFollowEnabled, setIsFollowEnabled,
        isPlaying, togglePlayback, bpm, samples, setBpm: updateBpmGlobal,
        setChokeGroup, selectedSampleId, setSelectedSampleId, lastTriggerTime, lastTriggerRef,
        numBars, setNumBars, tapBpm, loadFile, stopAll, setSampleStart, setSampleEnd,
        doubleBpm: () => updateBpmGlobal(bpm * 2),
        halfBpm: () => updateBpmGlobal(bpm / 2),
        currentBarIdx: Math.floor(activeStep / (rows * cols)),
        playSampleSolo
    };
};