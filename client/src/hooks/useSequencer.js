import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';
import { useSocketManager } from "./useSocketManager.js";
import { useAudioEngine } from "./useAudioEngine.js";

export const useSequencer = (
    gridState,
    setGridState,
    socket,
    roomName,
    rows = 4, cols = 4) => {
    const [samples, setSamples] = useState([]);
    const [selectedSampleId, setSelectedSampleId] = useState(null);
    const [activeStep, setActiveStep] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [numBars, setNumBars] = useState(1);
    const [lastTriggerTime, setLastTriggerTime] = useState(0);

    const players = useRef({});
    const sampleRef = useRef([]);
    const gridRef = useRef(gridState);
    const lastTriggerRef = useRef(0);

    const tapTimes = useRef([]);
    const [viewingBar, setViewingBar] = useState(0);
    const [isFollowEnabled, setIsFollowEnabled] = useState(true);

    const { shouldIgnoreServer, emitEvent } = useSocketManager(socket, roomName);

    // Sync refs for audio engine
    useEffect(() => { gridRef.current = gridState; }, [gridState]);
    useEffect(() => { sampleRef.current = samples; }, [samples]);

    const triggerSample = useCallback((sampleId, time) => {
        const player = players.current[sampleId];
        const data = sampleRef.current.find(s => s.id === sampleId);


        if (player?.loaded && data) {

            if (data.chokeGroup && data.chokeGroup !== 'none') {
                sampleRef.current.forEach(otherSample => {
                    // Sample in same group but not the active pad
                    if (otherSample.chokeGroup === data.chokeGroup && otherSample.id !== sampleId) {
                        const otherPlayer = players.current[otherSample.id];
                        if (otherPlayer) {
                            // Stop player when new one starts
                            otherPlayer.stop(time);
                        }
                    }
                });
            }

            const offset = (data.startTime || 0) / 1000;
            const duration = ((data.endTime || (player.buffer.duration * 1000)) / 1000) - offset;
            player.start(time, offset, duration);

            lastTriggerRef.current = time;
            setLastTriggerTime(time);
        }
    }, []);

    // Audio Engine Orchestration
    useAudioEngine(
        bpm,
        numBars,
        isPlaying,
        gridRef,
        triggerSample,
        setActiveStep,
        rows,
        cols
    );

    const updateBpmGlobal = (val) => {
        const safeVal = Number.isFinite(val) ? val : 120;
        const clamped = Math.max(30, Math.min(300, safeVal));
        setBpm(clamped);
        emitEvent('bpm-change', clamped);
    };

    const addBar = useCallback(() => {
        setNumBars(prevBars => {
            const newBars = prevBars + 1;
            setGridState(prevGrid => {
                const extraPads = Array.from({ length: rows * cols }, () => ({
                    isActive: false,
                    sampleId: null
                }));
                const newState = [...prevGrid, ...extraPads];
                emitEvent('update-entire-grid', { grid: newState, numBars: newBars });
                return newState;
            });
            return newBars;
        });
    }, [rows, cols, emitEvent, setGridState]);

    const deleteBar = useCallback((barIdx) => {
        setNumBars(prevBars => {
            if (prevBars <= 1) return prevBars;
            const newBars = prevBars - 1;
            setGridState(prevGrid => {
                const stepsPerBar = rows * cols;
                const newState = [...prevGrid];
                newState.splice(barIdx * stepsPerBar, stepsPerBar);
                emitEvent('update-entire-grid', { grid: newState, numBars: newBars });
                return newState;
            });
            return newBars;
        });
    }, [rows, cols, emitEvent, setGridState]);

    const togglePlayback = useCallback(async () => {
        if (Tone.getContext().state !== 'running') await Tone.start();

        const nextState = !isPlaying;

        // Local Audio Control
        if (nextState) {
            Tone.getTransport().start();
        } else {
            Tone.getTransport().pause();
        }

        setIsPlaying(nextState);
        emitEvent('transport-toggle', { isPlaying: nextState });
    }, [isPlaying, emitEvent]);

    const stopAll = useCallback(() => {
        console.log("[LOCAL] Stop all audio... Sending to Room:", roomName);

        // Reset local state immediately
        setIsPlaying(false);
        setActiveStep(-1);
        Tone.getTransport().stop();
        Tone.getTransport().position = 0;
        Object.values(players.current).forEach(p => p.stop());

        // Tell emit to bypass any manager locks
        if (socket) {
            socket.emit('stop-all-audio', { roomId: roomName });
        }
    }, [socket, roomName]);

    // Sample Control Logic
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

    // Socket Sync
    useEffect(() => {
        if (!socket) return;

        socket.on('update-bpm', (newBpm) => {
            if (shouldIgnoreServer()) return;
            setBpm(newBpm);
        });

        socket.on('sync-entire-grid', ({ grid, numBars: remoteBars }) => {
            if (!shouldIgnoreServer()) {
                setGridState(grid);
                setNumBars(remoteBars);
            }
        });

        socket.on('update-transport', ({ isPlaying: remoteIsPlaying }) => {

            console.log(`[SYNC] Remote transport change: ${remoteIsPlaying ? 'PLAY' : 'PAUSE'}`);

            setIsPlaying(remoteIsPlaying);

            // Start/Stop audio clock
            if (remoteIsPlaying) {
                Tone.getTransport().start();
            } else {
                Tone.getTransport().pause();
            }

        });

        socket.on('update-state', ({ index, newState }) =>{
            if(shouldIgnoreServer()) return;

            console.log(`[SYNC] Updating pad at index ${index}`);
            setGridState(prevGrid => {
                const newGrid = [...prevGrid];
                newGrid[index] = newState;
                return newGrid;
            });
        });

        socket.on('initial-state', async (data) => {
            if (data.samples) {
                for (const s of data.samples) {
                    if (!players.current[s.id]) await addNewPlayer(s.id, s.url, s.name);
                }
            }
            if (data.grid) setGridState(data.grid);
            if (data.numBars) setNumBars(data.numBars);
            if (data.bpm) setBpm(data.bpm);
        });

        socket.on('download-sample', async (sampleData) => {
            console.log(`[RECEIVE] New sample notification: ${sampleData.name}`);
            // Call existing function to create the Tone.Player
            await addNewPlayer(sampleData.id, sampleData.url, sampleData.name);
        });

        socket.on('sync-stop', () => {
            console.log("[SOCKET] Global Sync-Stop received. Killing all audio.");

            // Reset the UI State
            setIsPlaying(false);
            setActiveStep(-1);

            // Stop the Global Transport (Clock)
            Tone.getTransport().stop();
            Tone.getTransport().position = 0;
            Tone.getTransport().cancel(); // This clears any scheduled events

            // Force stop every individual sample player immediately
            if (players.current) {
                Object.values(players.current).forEach(p => {
                    if (p && typeof p.stop === 'function') {
                        p.stop();
                    }
                });
            }
        });

        return () => {
            socket.off('update-state')
            socket.off('update-bpm');
            socket.off('sync-entire-grid');
            socket.off('update-transport');
            socket.off('initial-state');
            socket.off('download-sample');
            socket.off('sync-stop');
        };
    }, [socket, shouldIgnoreServer, setGridState, roomName ]);

    const addNewPlayer = async (id, url, name) => {

        if (players.current[id]) return;

        try {
            console.log(`[AUDIO] Decoding buffer for: ${name} ...`);
            const startTime = performance.now();

            const newPlayer = new Tone.Player().toDestination();
            await newPlayer.load(url);

            const duration = (performance.now() - startTime).toFixed(2);
            players.current[id] = newPlayer;

            console.log(`[AUDIO] ${name} ready! Load time: ${duration}ms`);

            setSamples(prev => [...prev, {
                id, name, url, buffer: newPlayer.buffer,
                startTime: 0, endTime: newPlayer.buffer.duration * 1000,
                chokeGroup: "none"
            }]);
        } catch (err) {
            console.error(`[AUDIO] Failed to load ${url}:`, err);
        }
    };

    const loadFile = async (file) => {
        console.log(`[UPLOAD] Starting upload for: ${file.name}`);

        const formData = new FormData();
        formData.append('file', file);

        const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:4000' : window.location.origin;

        try {
            const response = await fetch(`${serverUrl}/upload-sample`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("Upload failed");

            const data = await response.json();

            console.log("[UPLOAD] Server responded with URL:", data.url);

            const id = crypto.randomUUID();
            await addNewPlayer(id, data.url, data.name);
            socket.emit('share-sample', {
                roomId: roomName,
                sampleData: { url: data.url, name: data.name, id: Date.now() }
            });
            console.log("[SOCKET] Broadcast 'share-sample' sent to server");

        } catch (err) { console.error("Upload error:", err); }
    };

    // Derived State
    const currentBarIdx = activeStep === -1 ? 0 : Math.floor(activeStep / (rows * cols));

    return {
        activeStep,
        viewingBar,
        setViewingBar,
        isFollowEnabled,
        setIsFollowEnabled,
        isPlaying,
        togglePlayback,
        bpm,
        samples,
        selectedSampleId,
        setSelectedSampleId,
        lastTriggerTime,
        lastTriggerRef,
        numBars,
        addBar,
        deleteBar,
        stopAll,
        currentBarIdx,

        tapBpm,
        loadFile,
        setBpm: updateBpmGlobal,
        setChokeGroup,
        setSampleStart,
        setSampleEnd,
        playSampleSolo,
        doubleBpm: () => updateBpmGlobal(bpm * 2),
        halfBpm: () => updateBpmGlobal(bpm / 2),
    };
};