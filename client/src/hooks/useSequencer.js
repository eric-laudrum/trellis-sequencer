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
    const bpmRef = useRef(bpm);
    useEffect(() => { bpmRef.current = bpm; }, [bpm]);

    const tapTimes = useRef([]);
    const [viewingBar, setViewingBar] = useState(0);
    const [isFollowEnabled, setIsFollowEnabled] = useState(true);

    const { shouldIgnoreServer, emitEvent } = useSocketManager(socket, roomName);

    const getSeqStep = useCallback((domIdx) => {
        const stepsPerBar = rows * cols;
        const barOffset = Math.floor(domIdx / stepsPerBar) * stepsPerBar;
        const localIdx = domIdx % stepsPerBar;
        const col = localIdx % cols;
        const domRow = Math.floor(localIdx / cols);
        const seqRow = (rows - 1) - domRow;
        return barOffset + (seqRow * cols) + col;
    }, [rows, cols]);

    const getDomIdx = useCallback((seqStep) => {
        const stepsPerBar = rows * cols;
        const barOffset = Math.floor(seqStep / stepsPerBar) * stepsPerBar;
        const localStep = seqStep % stepsPerBar;
        const col = localStep % cols;
        const seqRow = Math.floor(localStep / cols);
        const domRow = (rows - 1) - seqRow;
        return barOffset + (domRow * cols) + col;
    }, [rows, cols]);


    // Sync refs for audio engine
    useEffect(() => { gridRef.current = gridState; }, [gridState]);
    useEffect(() => { sampleRef.current = samples; }, [samples]);

    // Stock sounds
    useEffect(() => {
        const loadStockSounds = async () => {
            const loadedSamples = [];

            for (const sound of STOCK_SOUNDS) {
                if (!players.current[sound.id]) {

                    // Lock it synchronously so the 2nd React render ignores it
                    players.current[sound.id] = "loading";

                    try {
                        const newPlayer = new Tone.Player().toDestination();
                        await newPlayer.load(sound.url);

                        newPlayer.url = sound.url;

                        // Overwrite the "loading" lock with the actual loaded player
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

    const movePad = useCallback((sourceIndex, targetIndex) => {
        if (sourceIndex === targetIndex) return;

        setGridState(prev => {
            const next = [...prev];
            const sourcePad = next[sourceIndex];

            // Don't do anything if the pad is empty
            if (!sourcePad || !sourcePad.isActive) return prev;

            const clearedSourcePad = { isActive: false, sampleIds: [], userId: null, holds: {} };
            const newTargetPad = { ...sourcePad };

            next[sourceIndex] = clearedSourcePad;
            next[targetIndex] = newTargetPad;

            // Emit two toggle events to sync the move to other players in the room
            emitEvent('pad-toggle', { index: sourceIndex, newState: clearedSourcePad });
            emitEvent('pad-toggle', { index: targetIndex, newState: newTargetPad });

            return next;
        });
    }, [setGridState, emitEvent]);

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
                            if (otherPlayer) otherPlayer.stop(time);
                        }
                    });
                }

                const offset = (data.startTime || 0) / 1000;
                let duration = ((data.endTime || (player.buffer.duration * 1000)) / 1000) - offset;

                if (data.playbackMode === 'hold') {
                    const familyId = data.parentId || data.id;
                    let currentStep = stepIndex;

                    let pad = gridRef.current[currentStep];

                    const stepActuallyHasSample = pad?.sampleIds?.some(id => {
                        const s = sampleRef.current.find(x => x.id === id);
                        return s && (s.parentId === familyId || s.id === familyId);
                    });

                    if (!stepActuallyHasSample) {
                        const correctIndex = gridRef.current.findIndex(p => p?.holds?.[familyId] !== undefined);
                        if (correctIndex !== -1) {
                            currentStep = correctIndex;
                            pad = gridRef.current[currentStep];
                        }
                    }

                    const holdEndIndex = pad?.holds?.[familyId];

                    let stepsHeld = 1;
                    if (holdEndIndex !== undefined) {
                        const startSeq = getSeqStep(currentStep);
                        const endSeq = getSeqStep(holdEndIndex);
                        if (endSeq > startSeq) {
                            stepsHeld = (endSeq - startSeq) + 2;
                        }
                    }

                    const currentBPM = bpmRef.current;
                    const stepDurationSeconds = 60 / currentBPM / 2;
                    const requestedHoldSeconds = stepsHeld * stepDurationSeconds;

                    player.start(time, offset);
                    player.stop(time + requestedHoldSeconds);

                    console.log(`[AUDIO DEBUG] Holding ${stepsHeld} upward pads at ${currentBPM} BPM = ${requestedHoldSeconds.toFixed(2)}s`);

                    lastTriggerRef.current = { time, offset };
                    setLastTriggerTime(time);
                    return;
                }

                player.fadeOut = 0.05;
                player.start(time, offset, duration);

                lastTriggerRef.current = { time, offset };
                setLastTriggerTime(time);
            }
        });
    }, [getSeqStep]);

    const [isLoopMode, setIsLoopMode] = useState(false);
    const [loopRange, setLoopRange] = useState(null);

    const toggleLoopMode = () => {
        setIsLoopMode(prev => {
            if (prev) setLoopRange(null);
            return !prev;
        });
    };

    const handleLoopPointSelect = useCallback((domIdx) => {
        const seqStep = getSeqStep(domIdx);
        setLoopRange(prev => {
            if (!prev || prev.length === 2) return [seqStep];
            const start = prev[0];
            return [Math.min(start, seqStep), Math.max(start, seqStep)];
        });
    }, [getSeqStep]);


    // Audio Engine Orchestration
    useAudioEngine(
        bpm,
        numBars,
        isPlaying,
        gridRef,
        triggerSample,
        setActiveStep,
        rows,
        cols,
        isLoopMode,
        loopRange
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
            name: `${baseName}`,
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
        const startSeq = getSeqStep(startIndex);
        const endSeq = getSeqStep(endIndex);

        if (endSeq <= startSeq) return;

        setGridState(prev => {
            const next = [...prev];
            const pad = next[startIndex];

            if (!pad) return prev;

            console.log(`[GRID] Saving Upward Hold! Pad ${startIndex} to ${endIndex} for family ${sampleId}`);

            next[startIndex] = {
                ...pad,
                holds: {
                    ...(pad.holds || {}),
                    [sampleId]: endIndex
                }
            };

            emitEvent('pad-toggle', { index: startIndex, newState: next[startIndex] });

            const stepsToClear = endSeq - startSeq;

            for (let i = 1; i <= stepsToClear; i++) {
                const clearSeqIdx = startSeq + i;
                const clearIdx = getDomIdx(clearSeqIdx) % next.length;
                const intermediatePad = next[clearIdx];

                if (intermediatePad) {
                    const currentIds = intermediatePad.sampleIds || (intermediatePad.sampleId ? [intermediatePad.sampleId] : []);

                    if (currentIds.length > 0) {
                        const newIds = currentIds.filter(id => {
                            const s = sampleRef.current.find(x => x.id === id);
                            return !(s && (s.parentId === sampleId || s.id === sampleId));
                        });

                        next[clearIdx] = {
                            ...intermediatePad,
                            sampleIds: newIds,
                            isActive: newIds.length > 0
                        };
                        emitEvent('pad-toggle', { index: clearIdx, newState: next[clearIdx] });
                    }
                }
            }

            return next;
        });
    }, [emitEvent, setGridState, getSeqStep, getDomIdx]);



    const setSampleStart = (sampleId, newStart) => {
        setSamples(prev => prev.map(s =>
            s.id === sampleId ? { ...s, startTime: newStart } : s
        ));
        if (socket) {
            socket.emit('update-sample-bounds', { roomId: roomName, sampleId, startTime: newStart });
        }
    };

    const setSampleEnd = (sampleId, newEnd) => {
        setSamples(prev => prev.map(s =>
            s.id === sampleId ? { ...s, endTime: newEnd } : s
        ));
        if (socket) {
            socket.emit('update-sample-bounds', { roomId: roomName, sampleId, endTime: newEnd });
        }
    };

    const setChokeGroup = (sampleId, group) => {
        setSamples(prev => prev.map(sample =>
            sample.id === sampleId
                ? { ...sample, chokeGroup: group === 'none' ? null : group }
                : sample
        ));
    };

    const setSampleVolume = (sampleIds, volume) => {
        const ids = Array.isArray(sampleIds) ? sampleIds : [sampleIds];

        setSamples(prev => prev.map(s => ids.includes(s.id) ? { ...s, volume } : s));

        ids.forEach(id => {
            const player = players.current[id];
            if (player) {
                const db = volume <= 0 ? -60 : 20 * Math.log10(volume / 100);
                player.volume.value = db;
            }
        });

        emitEvent('update-sample-volume', { sampleIds: ids, volume });
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

    const stopSampleSolo = (id) => {
        const player = players.current[id];
        if (player?.loaded) {
            player.stop();
            lastTriggerRef.current = { time: 0, offset: 0 };
            setLastTriggerTime(0);
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
                    if (!players.current[s.id]) {
                        // Check if another sample already loaded this URL
                        const existingPlayer = Object.values(players.current).find(p => p.url === s.url);

                        if (existingPlayer && existingPlayer.buffer) {
                            players.current[s.id] = existingPlayer; // reuse!
                            setSamples(prev => {
                                if (prev.find(x => x.id === s.id)) return prev;
                                return [...prev, {
                                    ...s,
                                    buffer: existingPlayer.buffer
                                }];
                            });
                        } else {
                            await addNewPlayer(s);
                        }
                    }
                }
            }
            if (data.grid) setGridState(data.grid);
            if (data.numBars) setNumBars(data.numBars);
            if (data.bpm) setBpm(data.bpm);
        });

        socket.on('download-sample', async (sampleData) => {
            console.log(`[RECEIVE] New sample notification: ${sampleData.name}`);
            const existingPlayer = Object.values(players.current).find(p => p.url === sampleData.url);

            if (existingPlayer && existingPlayer.buffer) {
                // Reuse existing buffer/player for the new ID
                players.current[sampleData.id] = existingPlayer;

                setSamples(prev => {
                    if (prev.find(x => x.id === sampleData.id)) return prev;
                    return [...prev, {
                        ...sampleData,
                        buffer: existingPlayer.buffer,
                        chokeGroup: sampleData.chokeGroup || "none"
                    }];
                });
            } else {
                await addNewPlayer(sampleData);
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

        socket.on('update-sample-bounds', (data) => {

            // Update server's saved state array to sync users
            if (rooms[data.roomId]) {
                const sample = rooms[data.roomId].samples.find(s => s.id === data.sampleId);
                if (sample) {
                    if (data.startTime !== undefined) sample.startTime = data.startTime;
                    if (data.endTime !== undefined) sample.endTime = data.endTime;
                }
            }

            // Broadcast the change to the room
            socket.to(data.roomId).emit('update-sample-bounds', data);
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

        socket.on('update-sample-volume', ({ sampleIds, volume }) => {
            if (shouldIgnoreServer()) return;
            setSamples(prev => prev.map(s => sampleIds.includes(s.id) ? { ...s, volume } : s));

            sampleIds.forEach(id => {
                if (players.current[id]) {
                    const db = volume <= 0 ? -60 : 20 * Math.log10(volume / 100);
                    players.current[id].volume.value = db;
                }
            });
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
            socket.off('update-sample-volume');
        };
    }, [socket, shouldIgnoreServer, setGridState, roomName ]);

    const addNewPlayer = async (sampleData) => {
        if (players.current[sampleData.id]) return;

        try {
            console.log(`[AUDIO] Decoding buffer for: ${sampleData.name} ...`);
            const startTime = performance.now();

            const newPlayer = new Tone.Player().toDestination();
            await newPlayer.load(sampleData.url);

            // 🚨 CRITICAL: Tag the player with the URL so duplicates can find and reuse it later
            newPlayer.url = sampleData.url;

            players.current[sampleData.id] = newPlayer;

            const duration = (performance.now() - startTime).toFixed(2);
            console.log(`[AUDIO] ${sampleData.name} ready! Load time: ${duration}ms`);

            setSamples(prev => [...prev, {
                ...sampleData,
                buffer: newPlayer.buffer,
                startTime: sampleData.startTime !== undefined ? sampleData.startTime : 0,
                endTime: sampleData.endTime !== undefined ? sampleData.endTime : newPlayer.buffer.duration * 1000,
                chokeGroup: sampleData.chokeGroup || "none",
                color: sampleData.color || '#f5820a'
            }]);
        } catch (err) {
            console.error(`[AUDIO] Failed to load ${sampleData.url}:`, err);
        }
    };

    const loadFile = async (file) => {
        if (!file.type.startsWith('audio/')) {
            alert("Invalid file type. Please upload an audio file.");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert("File is too large. Maximum size is 10MB.");
            return;
        }

        console.log(`[UPLOAD] Starting upload for: ${file.name}`);
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

            const sampleDataPayload = { id, url: data.url, name: data.name, color: newColor };

            await addNewPlayer(sampleDataPayload);

            socket.emit('share-sample', {
                roomId: roomName,
                sampleData: sampleDataPayload
            });
            console.log("[SOCKET] Broadcast 'share-sample' sent to server");

        } catch (err) { console.error("Upload error:", err); }
    };

    // Derived State
    const currentBarIdx = activeStep === -1 ? 0 : Math.floor(activeStep / (rows * cols));

    return {
        movePad,
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
        setSampleVolume,
        playSampleSolo,
        stopSampleSolo,
        doubleBpm: () => updateBpmGlobal(bpm * 2),
        halfBpm: () => updateBpmGlobal(bpm / 2),
        setSampleColor,
        setPlaybackMode,
        setPadHold,
        isLoopMode,
        loopRange,
        toggleLoopMode,
        handleLoopPointSelect,
        
    };
};