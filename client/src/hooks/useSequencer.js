import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';
import { useSocketManager } from "./useSocketManager.js";
import { useAudioEngine } from "./useAudioEngine.js";


const STOCK_SOUNDS = [
    {
        id: 'stock-sample',
        name: 'Everyday of My Life',
        color: '#ff4444',
        url: 'https://res.cloudinary.com/dwzfulzjm/video/upload/v1790130923/AugustineTwins-EverydayOfMyLife-1967_joey5h.wav',
        chokeGroup: 'none'
    },
    {
        id: 'stock-break',
        name: '80BPM Break',
        color: '#007AFF',
        url: 'https://res.cloudinary.com/dwzfulzjm/video/upload/v1790130915/80_BPM_Side_Stick_Stop_nlh5yo.wav',
        chokeGroup: 'none'
    }
];

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
    const [deleteMode, setDeleteMode] = useState(false);

    const players = useRef({});
    const sampleRef = useRef([]);
    const gridRef = useRef(gridState);
    const lastTriggerRef = useRef({ time: 0, offset: 0 });

    const tapTimes = useRef([]);
    const [viewingBar, setViewingBar] = useState(0);
    const [isFollowEnabled, setIsFollowEnabled] = useState(true);

    const { shouldIgnoreServer, emitEvent } = useSocketManager(socket, roomName);


    // Sync refs for audio engine
    useEffect(() => { gridRef.current = gridState; }, [gridState]);
    useEffect(() => { sampleRef.current = samples; }, [samples]);

    // Stock sounds
    useEffect(() => {
        const loadStockSounds = async () => {
            const loadedSamples = [];

            for (const sound of STOCK_SOUNDS) {
                // 1. Check if it exists OR is currently loading
                if (!players.current[sound.id]) {

                    // 2. IMMEDIATELY lock it synchronously so the 2nd React render ignores it
                    players.current[sound.id] = "loading";

                    try {
                        const newPlayer = new Tone.Player().toDestination();
                        await newPlayer.load(sound.url);

                        // 3. Overwrite the "loading" lock with the actual loaded player
                        players.current[sound.id] = newPlayer;

                        loadedSamples.push({
                            ...sound,
                            buffer: newPlayer.buffer,
                            startTime: 0,
                            endTime: newPlayer.buffer.duration * 1000
                        });
                    } catch (err) {
                        // If it fails, remove the lock so it can be retried later if needed
                        delete players.current[sound.id];
                        console.error(`Failed to load stock sound ${sound.name}:`, err);
                    }
                }
            }

            if (loadedSamples.length > 0) {
                setSamples(prev => {
                    // Create an entirely new array for React
                    const next = [...prev];

                    loadedSamples.forEach(loadedData => {
                        const idx = next.findIndex(p => p.id === loadedData.id);
                        if (idx > -1) {
                            // DEEP CLONE the object so WaveformEditor registers the change
                            next[idx] = {
                                ...next[idx],
                                buffer: loadedData.buffer,
                                endTime: loadedData.endTime
                            };
                        } else {
                            next.push(loadedData);
                        }
                    });

                    return next;
                });
            }
        };

        loadStockSounds();
    }, []);

    const triggerSample = useCallback((sampleIdOrArray, time, stepIndex) => {
        const ids = Array.isArray(sampleIdOrArray) ? sampleIdOrArray : [sampleIdOrArray];

        ids.forEach(sampleId => {
            if (!sampleId) return;
            const player = players.current[sampleId];
            const data = sampleRef.current.find(s => s.id === sampleId);

            if (player?.loaded && data) {
                if (data.chokeGroup && data.chokeGroup !== 'none') {
                    sampleRef.current.forEach(otherSample => {
                        if (otherSample.chokeGroup === data.chokeGroup && otherSample.id !== sampleId) {
                            const otherPlayer = players.current[otherSample.id];
                            if (otherPlayer) {
                                otherPlayer.stop(time);
                            }
                        }
                    });
                }

                const offset = (data.startTime || 0) / 1000;
                let duration = ((data.endTime || (player.buffer.duration * 1000)) / 1000) - offset;

                if (data.playbackMode === 'hold') {
                    let currentStep = stepIndex;
                    if (currentStep === undefined) {
                        const ticks = Tone.Transport.getTicksAtTime(time);
                        const stepTicks = Tone.Time("16n").toTicks();
                        currentStep = Math.round(ticks / stepTicks) % gridRef.current.length;
                    }

                    const pad = gridRef.current[currentStep];
                    const familyId = data.parentId || data.id;
                    const holdEndIndex = pad?.holds?.[familyId];
                    const stepDuration = 60 / Tone.Transport.bpm.value / 4;

                    let stepsHeld = 1;
                    if (holdEndIndex !== undefined) {
                        if (holdEndIndex >= currentStep) {
                            stepsHeld = (holdEndIndex - currentStep) + 1;
                        } else {
                            stepsHeld = (gridRef.current.length - currentStep) + holdEndIndex + 1;
                        }
                    }

                    duration = Math.min(duration, stepsHeld * stepDuration);
                    player.stop(time + duration);
                }

                player.start(time, offset, duration);

                lastTriggerRef.current = { time, offset };
                setLastTriggerTime(time);
            }
        });
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

    const deleteSample = useCallback((sampleId) => {
        setSamples(prev => prev.filter(s => s.id !== sampleId));

        if (players.current[sampleId]) {
            players.current[sampleId].stop();
            delete players.current[sampleId];
        }

        setGridState(prevGrid => {
            const newGrid = prevGrid.map(pad => {
                const currentIds = pad.sampleIds || [];
                if (currentIds.includes(sampleId)) {
                    const newIds = currentIds.filter(id => id !== sampleId);
                    return {
                        ...pad,
                        sampleIds: newIds,
                        isActive: newIds.length > 0
                    };
                }
                return pad;
            });

            emitEvent('update-entire-grid', { grid: newGrid, numBars });
            return newGrid;
        });

        setSelectedSampleId(prev => prev === sampleId ? null : prev);

        socket.emit('delete-sample', sampleId);
    }, [emitEvent, numBars, setGridState, socket]);

    const clearPad = useCallback((index)=>{
        setGridState(prevGrid => {
            const newGrid = [...prevGrid];
            newGrid[index] = {isActive: false, sampleId: null};

            emitEvent('update-state', {index, newState: newGrid[index]});
            return newGrid;
        })
    }, [setGridState, emitEvent]);

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

        setLastTriggerTime(0);
        lastTriggerRef.current = { time: 0, offset: 0 };

        Tone.getTransport().stop();
        Tone.getTransport().position = 0;
        Object.values(players.current).forEach(p => p.stop());

        // Tell emit to bypass any manager locks
        if (socket) {
            socket.emit('stop-all-audio', { roomId: roomName });
        }
    }, [socket, roomName]);

    const duplicateSample = useCallback((sampleId, cutTime = null) => {
        const sourceSample = samples.find(s => s.id === sampleId);
        if (!sourceSample) return;

        const newId = crypto.randomUUID();
        const parentId = sourceSample.parentId || sourceSample.id;

        const originalSample = samples.find(s => s.id === parentId) || sourceSample;
        const baseName = originalSample.name;

        const relatedSlices = samples.filter(s => s.parentId === parentId);
        const sliceNumber = relatedSlices.length + 1;

        const newStartTime = cutTime !== null ? cutTime : sourceSample.startTime;
        const newEndTime = sourceSample.buffer ? sourceSample.buffer.duration * 1000 : sourceSample.endTime;

        const duplicatedSample = {
            ...sourceSample,
            id: newId,
            parentId: parentId,
            name: `${baseName} - Slice ${sliceNumber}`,
            color: sourceSample.color || '#f1ad36',
            startTime: newStartTime,
            endTime: newEndTime,
        };

        players.current[newId] = players.current[sampleId];
        setSamples(prev => [...prev, duplicatedSample]);

        socket.emit('share-sample', {
            roomId: roomName,
            sampleData: {
                ...duplicatedSample,
                url: sourceSample.url
            }
        });
    }, [samples, roomName, socket]);

    const setSampleColor = (sampleId, color) => {
        setSamples(prev => prev.map(s =>
            s.id === sampleId ? { ...s, color } : s
        ));
        // Sync colour with the room
        emitEvent('update-sample-color', { sampleId, color });
    };

    const setPlaybackMode = (sampleId, mode) => {
        setSamples(prev => prev.map(s => s.id === sampleId ? { ...s, playbackMode: mode } : s));
    };


    const setPadHold = useCallback((startIndex, endIndex, sampleId) => {
        setGridState(prev => {
            const next = [...prev];
            if (!next[startIndex].sampleIds?.includes(sampleId)) return prev;

            next[startIndex] = {
                ...next[startIndex],
                holds: {
                    ...(next[startIndex].holds || {}),
                    [sampleId]: endIndex
                }
            };
            emitEvent('update-state', { index: startIndex, newState: next[startIndex] });
            return next;
        });
    }, [emitEvent, setGridState]);

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
            const offset = (sampleData.startTime || 0) / 1000;

            player.start(now, offset);
            lastTriggerRef.current = { time: now, offset };
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
            const existingPlayerEntry = Object.entries(players.current).find(([id, p]) => p.url === sampleData.url);

            if (existingPlayerEntry) {
                // Reuse existing buffer/player for the new ID
                players.current[sampleData.id] = existingPlayerEntry[1];
                
                setSamples(prev => [...prev, {
                    ...sampleData,
                    buffer: existingPlayerEntry[1].buffer,
                    chokeGroup: sampleData.chokeGroup || "none"
                }]);
            } else {

                await addNewPlayer(sampleData.id, sampleData.url, sampleData.name);
            }
        });

        socket.on('sync-stop', () => {
            console.log("[SOCKET] Global Sync-Stop received. Killing all audio.");

            // Reset the UI State
            setIsPlaying(false);
            setActiveStep(-1);

            setLastTriggerTime(0);
            lastTriggerRef.current = { time: 0, offset: 0 };

            // Stop the Global Transport (Clock)
            Tone.getTransport().stop();
            Tone.getTransport().position = 0;
            Tone.getTransport().cancel();

            // Force stop every individual sample player immediately
            if (players.current) {
                Object.values(players.current).forEach(p => {
                    if (p && typeof p.stop === 'function') {
                        p.stop();
                    }
                });
            }
        });

        socket.on('remove-sample', (id) => {
            setSamples(prev => prev.filter(s => s.id !== id));
            if (players.current[id]) {
                players.current[id].stop();
                delete players.current[id];
            }
            setGridState(prevGrid => {
                return prevGrid.map(pad => {
                    const currentIds = pad.sampleIds || [];
                    if (currentIds.includes(id)) {
                        const newIds = currentIds.filter(sampleId => sampleId !== id);
                        return { ...pad, sampleIds: newIds, isActive: newIds.length > 0 };
                    }
                    return pad;
                });
            });
            setSelectedSampleId(prev => prev === id ? null : prev);
        });

        return () => {
            socket.off('update-state')
            socket.off('update-bpm');
            socket.off('sync-entire-grid');
            socket.off('update-transport');
            socket.off('initial-state');
            socket.off('download-sample');
            socket.off('sync-stop');
            socket.off('remove-sample');
        };
    }, [socket, shouldIgnoreServer, setGridState, roomName ]);

    const addNewPlayer = async (id, url, name, color = '#f5820a') => {
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
                chokeGroup: "none",
                color: color
            }]);
        } catch (err) {
            console.error(`[AUDIO] Failed to load ${url}:`, err);
        }
    };

    const loadFile = async (file) => {
        console.log(`[UPLOAD] Starting upload for: ${file.name}`);

        const formData = new FormData();
        formData.append('file', file);

        const serverUrl = window.location.hostname === 'localhost'
            ? 'http://localhost:4000'
            : 'https://trellis-sequencer.onrender.com';

        try {
            const response = await fetch(`${serverUrl}/upload-sample`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("Upload failed");

            const data = await response.json();

            console.log("[UPLOAD] Server responded with URL:", data.url);

            const id = crypto.randomUUID();

            // Generate a random bright UI color from a palette
            const PALETTE = ['#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55', '#E040FB'];
            const newColor = PALETTE[Math.floor(Math.random() * PALETTE.length)];

            await addNewPlayer(id, data.url, data.name, newColor);

            socket.emit('share-sample', {
                roomId: roomName,
                sampleData: { url: data.url, name: data.name, id: id, color: newColor }
            });
            console.log("[SOCKET] Broadcast 'share-sample' sent to server");

        } catch (err) { console.error("Upload error:", err); }
    };

    // Derived State
    const currentBarIdx = activeStep === -1 ? 0 : Math.floor(activeStep / (rows * cols));

    return {
        deleteMode,
        setDeleteMode,
        clearPad,
        activeStep,
        viewingBar,
        isFollowEnabled,
        isPlaying,
        bpm,
        samples,
        selectedSampleId,
        lastTriggerTime,
        lastTriggerRef,
        numBars,
        currentBarIdx,
        setViewingBar,
        setIsFollowEnabled,
        togglePlayback,
        setSelectedSampleId,
        addBar,
        deleteBar,
        stopAll,
        duplicateSample,
        deleteSample,
        tapBpm,
        loadFile,
        setBpm: updateBpmGlobal,
        setChokeGroup,
        setSampleStart,
        setSampleEnd,
        playSampleSolo,
        doubleBpm: () => updateBpmGlobal(bpm * 2),
        halfBpm: () => updateBpmGlobal(bpm / 2),
        setSampleColor,
        setPlaybackMode,
        setPadHold
        
    };
};