import {useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';

export const useSequencer = ( gridState, rows = 4, cols = 4 ) => {

    const [ activeStep, setActiveStep ] = useState(-1);
    const [ isPlaying, setIsPlaying ] = useState(false);
    const [ bpm, setBpm ] = useState( 120 );

    const player = useRef(null);
    const gridRef = useRef( gridState );

    // Update loop with latest toggles
    useEffect(() =>{
        gridRef.current = gridState;
    }, [ gridState ]);

    // Update BPM
    useEffect(() => {
        Tone.getTransport().bpm.value = bpm;
    }, [bpm]);


    const loadFile = async (file) => {
        const url = URL.createObjectURL(file);
        if (player.current) player.current.dispose();
        player.current = new Tone.Player(url).toDestination();
    };

    useEffect(() => {
        // Generate sequence play order
        const getSequenceOrder = () =>{
            const order = [];
            // Bottom left to top right
            for( let r = rows -1; r >= 0; r-- ) {
                for (let c = 0; c < cols; c++ ) {
                    order.push(r * cols + c);
                }
            }
            return order;
        };

        const sequenceOrder = getSequenceOrder();

        const seq = new Tone.Sequence((time, stepIdx ) =>{
            const gridIndex = sequenceOrder[ stepIdx ];
            setActiveStep( gridIndex );

            // Accessing the object property dynamically
            const cell = gridRef.current[gridIndex];
            if (cell?.isActive && player.current?.loaded) {
                player.current.start(time);
            }

        }, Array.from({ length: rows * cols }, (_, i) => i), "8n");

        seq.start(0);
        return () => seq.dispose();
    }, [rows, cols]);

    const togglePlayback = useCallback(async () => {
        if (Tone.getContext().state !== 'running') await Tone.start();
        if (isPlaying) {
            Tone.getTransport().stop();
            Tone.getTransport().seconds = 0;
            setIsPlaying(false);
            setActiveStep(-1);
        } else {
            Tone.getTransport().seconds = 0;
            Tone.getTransport().start();
            setIsPlaying(true);
        }
    }, [isPlaying]);

    return { activeStep, isPlaying, togglePlayback, bpm, setBpm, loadFile };
};