import {useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';

export const useSequencer = ( gridState, rows = 4, cols = 4 ) => {

    const [ samples, setSamples ] = useState( [] );
    const [ selectedSampleId, setSelectedSampleId ] = useState( null );
    const [ activeStep, setActiveStep ] = useState(-1);
    const [ isPlaying, setIsPlaying ] = useState(false);
    const [ bpm, setBpm ] = useState( 120 );
    const [ sampleStart, setSampleStart ] = useState(0);

    const players = useRef({});
    const gridRef = useRef( gridState );

    const loadFile = async (file) => {
        const id = crypto.randomUUID();
        const url = URL.createObjectURL(file);

        // Load file into a buffer
        const newPlayer = new Tone.Player(url).toDestination();

        // Wait to load
        await newPlayer.load(url);

        players.current[id] = newPlayer;

        setSamples(prev => [...prev, {
            id,
            name: file.name,
            startTime: 0,
            buffer: newPlayer.buffer
        }]);
        setSelectedSampleId(id);
    };

    const updateSampleStart = (id, val) => {
        const num = parseFloat(val) || 0;
        setSamples(prev => prev.map( sample =>
            sample.id === id ? { ...sample, startTime: Number(num.toFixed(2)) } : sample
        ));
    };

    const changeStartTime = ( msValue ) =>{
        setSampleStart( msValue );
        if( selectedSampleId ){
            updateSampleStart( selectedSampleId, msValue / 1000 );
        }
    };

    const captureCurrentMoment = () => {
        if ( !selectedSampleId ) return;

        // Get current time in seconds
        const currentTime = Tone.getTransport().seconds;

        // Update start time with new time
        changeStartTime( currentTime * 1000 );

    };

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


    // Update loop with latest toggles
    useEffect(() =>{
        gridRef.current = gridState;
    }, [ gridState ]);

    // Update BPM
    useEffect(() => {
        Tone.getTransport().bpm.value = bpm;
    }, [bpm]);

    // Generate sequence play order
    useEffect(() => {
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

        const seq = new Tone.Sequence((time, stepIdx) => {
            const gridIndex = sequenceOrder[stepIdx];
            setActiveStep(gridIndex);

            const cell = gridRef.current[gridIndex];
            const padSampleId = cell?.sampleId;

            const playerToPlay = players.current[ padSampleId ];
            const sampleData = samples.find( sample => sample.id === padSampleId );


            // const currentPlayer = players.current[selectedSampleId];

            if (cell?.isActive && playerToPlay?.loaded) {
                const offset = sampleData ? sampleData.startTime : 0;
                playerToPlay.start(time, offset )
            }
        }, Array.from({ length: rows * cols }, (_, i) => i),
            "8n");

        seq.start(0);
        return () => seq.dispose();
    }, [rows, cols, samples ]);

    // Update slider to active pad's start time
    useEffect(() => {
        const activeSample = samples.find(s => s.id === selectedSampleId);
        if (activeSample) {
            setSampleStart(activeSample.startTime * 1000);
        }
    }, [selectedSampleId, samples]);

    return {
        activeStep,
        isPlaying,
        togglePlayback,
        bpm,
        setBpm,
        loadFile,
        sampleStart,
        setSampleStart: changeStartTime,
        captureCurrentMoment,
        samples,
        selectedSampleId,
        setSelectedSampleId
    };
};