import {useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';

export const useSequencer = ( gridState, rows = 4, cols = 4 ) => {

    const [ activeStep, setActiveStep ] = useState(-1);
    const [ isPlaying, setIsPlaying ] = useState(false);
    const [ bpm, setBpm ] = useState( 120 );
    const  synth = useRef(null);
    const gridRef= useRef( gridState );

    // Update reference when gridState changes
    useEffect(() => {
        gridRef.current = gridState;
    }, [ gridState ]);


    useEffect(() => {
        synth.current = new Tone.PolySynth(Tone.Synth).toDestination();
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

        // Test notes
        const rowNotes = ["C3", "E3", "G3", "C4"];

        const seq = new Tone.Sequence(
            (time, stepIdx ) =>{
                const gridIndex = sequenceOrder[ stepIdx ];
                setActiveStep( gridIndex );

                // Use reference to avoid stopping sample
                if( gridRef.current[ gridIndex ]){
                    // Find the related note
                    const currentRow = Math.floor(gridIndex / cols);
                    const note = rowNotes[ rows - 1 - currentRow ] || "C4";

                    synth.current.triggerAttackRelease(note, "16n", time);
                }
            },

            Array.from({ length: rows * cols },(_, i) => i),
                "8n"
        );

        seq.start(0);
        return () =>{
            seq.dispose();
            synth.current?.dispose();
        };
    }, [rows, cols ]); // Recreate the sequence if the dimensions change (tbd)
    useEffect(()=>{
        Tone.getTransport().bpm.value = bpm;
    }, [ bpm ]);

    const togglePlayback = useCallback (async ()=>{

        if(Tone.getContext().state !== 'running'){
            await Tone.start();
        }
        // Switch off
        if( isPlaying ){
            Tone.getTransport().stop();
            Tone.getTransport().seconds = 0; // reset to 0 index
            setIsPlaying( false );
            setActiveStep( -1);
        // Switch on
        } else {
            Tone.getTransport().seconds = 0;
            Tone.getTransport().start();
            setIsPlaying(true);

        }
    }, [ isPlaying ]);

    return { activeStep, isPlaying, togglePlayback, bpm, setBpm };
}