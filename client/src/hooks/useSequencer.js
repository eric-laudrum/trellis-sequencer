// hooks/useSequencer.js
import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';

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
    const gridRef = useRef(gridState);
    const sampleRef = useRef([]);
    const transport = Tone.getTransport();
    const tapTimes = useRef([]);
    const tapTimeoutRef = useRef(null);


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

    // Core logic
    const triggerSample = useCallback((sampleId, time) => {
        const player = players.current[sampleId];
        const sampleData = sampleRef.current.find(s => s.id === sampleId);

        if (player?.loaded && sampleData) {

            if (sampleData.chokeGroup && sampleData.chokeGroup !== 'none') {
                sampleRef.current.forEach(otherSample => {

                    // Choke group logic
                    if (otherSample.chokeGroup === sampleData.chokeGroup) {
                        players.current[otherSample.id]?.stop(time);
                    }
                });
            }

            const offset = (sampleData.startTime || 0) / 1000;
            const endTime = (sampleData.endTime || (player.buffer.duration * 1000)) / 1000;
            const duration = endTime - offset;


            player.start(time, offset, duration);

            // Sync triggers
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

    const tapBpm = () =>{
        const now = Date.now();

        // Last 4 taps
        const newTapTimes = [...tapTimes.current, now].slice(-4);
        tapTimes.current = newTapTimes;


        if (newTapTimes.length > 1) {
            const intervals = [];
            for (let i = 1; i < newTapTimes.length; i++) {
                intervals.push(newTapTimes[i] - newTapTimes[i - 1]);
            }

            const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
            const calculatedBpm = Math.round(60000 / avgInterval);
            const clamped = Math.max(30, Math.min(300, calculatedBpm));

            // This is the line that actually updates the state and server


            setBpm(clamped);
            transport.bpm.value = clamped;

            // Debounce the socket emit
            if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);

            tapTimeoutRef.current = setTimeout(() => {
                socket.emit('bpm-change', clamped);
            }, 500);
        }
    };






    // Socket listeners
    useEffect(() => {
        if (!socket){
            console.warn("useSequencer: Socket not found")
            return;
        }

        socket.on('initial-state', async (data) => {
            if (data.samples && data.samples.length > 0) {

                // Load every sample the room already has
                for (const s of data.samples) {

                    // Prevent duplicate loading
                    if (!players.current[s.id]) {
                        await addNewPlayer(s.id, s.url, s.name);
                    }
                }
            }
        });

        socket.on('update-transport', ({ isPlaying: remoteIsPlaying }) => {
            if (remoteIsPlaying) {
                transport.start();
                setIsPlaying(true);
            } else {
                transport.stop();
                transport.seconds = 0;
                setIsPlaying(false);
                setActiveStep(-1);
            }
        });

        socket.on('update-bpm', (newBpm) => {
            setBpm(prev => {
                if (Math.abs(prev - newBpm) > 0.1) {
                    transport.bpm.value = newBpm;
                    return newBpm;
                }
                return prev;
            });
        });

        const handleDownload = async ({ id, url, name }) => {
            await addNewPlayer(id, url, name);
        };
        socket.on('download-sample', handleDownload);

        socket.on('kill-audio-instantly', () => {
            // Stop the clock locally
            transport.stop();
            transport.seconds = 0;
            setActiveStep(-1);
            setIsPlaying(false);

            // Kill all active audio buffers
            Object.values(players.current).forEach(player => {
                player.stop();
            });

            // Reset visual triggers
            lastTriggerRef.current = 0;
            setLastTriggerTime(0);
        });


        return () => {
            socket.off('initial-state');
            socket.off('update-transport');
            socket.off('update-bpm');
            socket.off('download-sample', handleDownload);
            socket.off('kill-audio-instantly');
        };
    }, [socket, transport]);

    useEffect(() => {
        if (Math.abs(transport.bpm.value - bpm) > 0.1) {
            transport.bpm.value = bpm;
        }
    }, [bpm, transport]);

    const loadFile = async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const serverUrl = window.location.hostname === 'localhost'
            ? 'http://localhost:4000'
            : window.location.origin;

        try {
            const response = await fetch(`${serverUrl}/upload-sample`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("Upload failed status: " + response.status);

            const { url, name } = await response.json();
            const id = crypto.randomUUID();

            await addNewPlayer(id, url, name);

            socket.emit('share-sample', {
                roomId: roomName,
                sampleData: { id, url, name }
            });
        } catch (err) {
            console.error("Upload error:", err);
        }
    };

    const addNewPlayer = async (id, url, name) => {
        // Prevent duplicate samples
        if (players.current[id]) return;

        // Select appropriate backend location
        const backendBase = window.location.hostname === 'localhost'
            ? 'http://localhost:4000'
            : window.location.origin;

        const fileName = url.split('/').pop();
        const cleanUrl = `${backendBase}/uploads/${fileName}`;

        // Debug
        console.log("Attempting to load audio from:", cleanUrl);

        try {
            const newPlayer = new Tone.Player().toDestination();
            // Use the Promise-based load method
            await newPlayer.load(cleanUrl);

            players.current[id] = newPlayer;
            setSamples(prev => {
                if (prev.find(s => s.id === id)) return prev;
                return [...prev, {
                    id,
                    name,
                    url: cleanUrl,
                    buffer: newPlayer.buffer,
                    startTime: 0,
                    endTime: newPlayer.buffer.duration * 1000,
                    chokeGroup: "none",
                }];
            });
        } catch (err) {
            console.error("Tone.js could not load the file. Verify the url in browser: ", cleanUrl);
            console.error("Detailed Error:", err);
        }
    };


    // Sequencer Engine
    useEffect(() => {
        sampleRef.current = samples;
        gridRef.current = gridState;
    }, [samples, gridState]);


    // Handlers

    const updateBpmGlobal = (val) => {
        const clamped = Math.max(30, Math.min(300, val));
        setBpm(clamped);
        transport.bpm.value = clamped;
        socket.emit('bpm-change', clamped); // Tell the room
    };

    const togglePlayback = useCallback(async () => {
        if (Tone.getContext().state !== 'running') await Tone.start();
        const nextState = !isPlaying;

        if (nextState) transport.start();
        else {
            transport.stop();
            transport.seconds = 0;
            setActiveStep(-1);
        }
        setIsPlaying(nextState);
        socket.emit('transport-toggle', { isPlaying: nextState });
    }, [isPlaying, socket]);

    const stopAll = () => {
        // Stop the transport
        transport.stop();
        transport.seconds = 0;

        // Reset triggers
        lastTriggerRef.current = 0;
        setLastTriggerTime(0);

        Object.values(players.current).forEach(player => {
            player.stop();
            player.seek(0);
        });

        setIsPlaying(false);
        setActiveStep(-1);

        socket.emit('stop-all-audio');
        socket.emit('transport-toggle', { isPlaying: false });

    };





    // Update Refs
    useEffect(() => { sampleRef.current = samples; }, [samples]);
    useEffect(() => { gridRef.current = gridState; }, [gridState]);

    // Sync BPM
    useEffect(() => {
        transport.bpm.value = bpm;
    }, [bpm]);

    // Sequence Generator
    useEffect(() => {

        // Total number of steps
        const stepsPerBar = rows * cols;
        const totalSteps = stepsPerBar * numBars;


        const seq = new Tone.Sequence((time, stepIdx) => {
            const currentStepInBar = stepIdx % stepsPerBar;

            // Calculate grid coords
            const col = currentStepInBar % cols;
            const standardRow = Math.floor(currentStepInBar / cols);

            // Flip around to order bottom left to top right
            const flippedRow = (rows - 1) - standardRow;
            const gridIndex = (flippedRow * cols) + col;


            // Sync highlights
            Tone.Draw.schedule(() => {
                setActiveStep(gridIndex);
            }, time);

            const cell = gridRef.current[gridIndex];

            if (cell?.isActive && cell.sampleId) {
                triggerSample(cell.sampleId, time);
            }


        }, Array.from({ length: totalSteps }, (_, i) => i), "8n");

        if (isPlaying) {
            seq.start(0);
        } else {
            setActiveStep(-1);
        }

        return () => seq.dispose();
    }, [rows, cols, numBars, isPlaying, triggerSample]);


    return {
        activeStep,
        isPlaying,
        togglePlayback,
        bpm,
        samples,
        setBpm: updateBpmGlobal,
        setChokeGroup,
        selectedSampleId,
        setSelectedSampleId,
        lastTriggerTime,
        lastTriggerRef,
        numBars,
        setNumBars,
        tapBpm,
        loadFile,
        doubleBpm: () => updateBpmGlobal(bpm * 2),
        halfBpm: () => updateBpmGlobal(bpm / 2),
        stopAll,
        setSampleStart,
        setSampleEnd,
        currentBarIdx: Math.floor(activeStep / (rows * cols)),
        playSampleSolo: (id) => {
            const player = players.current[id];
            const sampleData = sampleRef.current.find(sample => sample.id === id);

            if (player?.loaded && sampleData) {
                const now = Tone.now();

                player.start(now, (sampleData.startTime || 0) / 1000);

                lastTriggerRef.current = now;
                setLastTriggerTime(now);
            }
        },
    };
};
