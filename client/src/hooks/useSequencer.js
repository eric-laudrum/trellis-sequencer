// hooks/useSequencer.js
import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';

export const useSequencer = (gridState, socket, roomName, rows = 4, cols = 4) => {
    const [samples, setSamples] = useState([]);
    const [selectedSampleId, setSelectedSampleId] = useState(null);
    const [activeStep, setActiveStep] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [sampleStart, setSampleStart] = useState(0);
    const [lastTriggerTime, setLastTriggerTime] = useState(0);

    const players = useRef({});
    const gridRef = useRef(gridState);
    const sampleRef = useRef([]);
    const transport = Tone.getContext().transport;

    // Socket listeners
    useEffect(() => {
        if (!socket){
            console.warn("useSequencer: Socket not found")
            return;
        }

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
            if (transport.bpm.value !== newBpm) {
                transport.bpm.value = newBpm;
                setBpm(newBpm);
            }
        });

        socket.on('download-sample', async ({ id, url, name }) => {
            await addNewPlayer(id, url, name);
        });


        return () => {
            socket.off('update-transport');
            socket.off('update-bpm');
            socket.off('download-sample');
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
        const newPlayer = new Tone.Player(url).toDestination();
        await newPlayer.load(url);

        // Check buffer exists before adding to the state
        if(newPlayer.buffer ){
            players.current[id] = newPlayer;
            setSamples( prev=> [...prev, {
                id,
                name,
                url,
                buffer: newPlayer.buffer,
                startTime: 0,
                chokeGroup: "none"
            }]);
        }
    };


    // Sequencer Engine
    useEffect(() => {
        sampleRef.current = samples;
        gridRef.current = gridState;
    }, [samples, gridState]);

    useEffect(() => {
        const order = [];
        for (let r = rows - 1; r >= 0; r--) {
            for (let c = 0; c < cols; c++) order.push(r * cols + c);
        }

        const seq = new Tone.Sequence((time, stepIdx) => {
            const gridIndex = order[stepIdx];
            setActiveStep(gridIndex);

            const cell = gridRef.current[gridIndex];
            if (isPlaying && cell?.isActive && cell.sampleId) {
                const player = players.current[cell.sampleId];
                if (player?.loaded) {
                    player.start(time);
                }
            }
        }, Array.from({ length: rows * cols }, (_, i) => i), "8n");

        seq.start(0);
        return () => seq.dispose();
    }, [rows, cols, isPlaying]);


    // Handlers

    const updateBpmGlobal = (val) => {
        const clamped = Math.max(30, Math.min(300, val));
        setBpm(clamped);
        socket.emit('bpm-change', clamped);
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

        Object.values(players.current).forEach(player => {
            player.stop();
            player.seek(0);
        });
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
                currentSamples.forEach(sample => {
                    if (sample.chokeGroup === sampleData.chokeGroup && sample.id !== sampleId) {
                        players.current[sample.id]?.stop(time);
                    }
                });
            }
            player.start(time, sampleData.startTime || 0);
            setLastTriggerTime(transport.seconds);
        }
    };



    // Files from other users
    useEffect(() => {
        socket.on('download-sample', async ({ id, url, name }) => {
            await addNewPlayer(id, url, name);
        });
    }, [socket]);


    // Update Refs
    useEffect(() => { sampleRef.current = samples; }, [samples]);
    useEffect(() => { gridRef.current = gridState; }, [gridState]);

    // Sync BPM
    useEffect(() => {
        transport.bpm.value = bpm;
    }, [bpm]);

    // Sequence Generator
    useEffect(() => {
        const order = [];
        for (let r = rows - 1; r >= 0; r--) {
            for (let c = 0; c < cols; c++) order.push(r * cols + c);
        }

        const seq = new Tone.Sequence((time, stepIdx) => {
            const gridIndex = order[stepIdx];

            // Update highlight locally
            setActiveStep(gridIndex);

            const cell = gridRef.current[gridIndex];

            if (isPlaying && cell?.isActive && cell.sampleId) {
                triggerSample(cell.sampleId, time);
            }
        }, Array.from({ length: rows * cols }, (_, i) => i), "8n");

        seq.start(0);
        return () => seq.dispose();
    }, [rows, cols, isPlaying]);


    return {
        activeStep,
        isPlaying,
        togglePlayback,
        bpm,
        samples,
        setBpm: updateBpmGlobal,
        setChokeGroup: (sampleId, group) =>{
            setSamples(prev => prev.maps(sample =>
                sample.id === sampleId ? {
                    ...sample, chokeGroup: group === 'none' ? null: group}:sample
            ));
        },
        selectedSampleId,
        setSelectedSampleId,
        loadFile,
        doubleBpm: () => updateBpmGlobal(bpm * 2),
        halfBpm: () => updateBpmGlobal(bpm / 2),
        stopAll,
        setSampleStart,
        playSampleSolo: (id) => { players.current[id]?.start(); }
    };
};