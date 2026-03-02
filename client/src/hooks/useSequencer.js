import {useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';

export const useSequencer = ( gridState, rows = 4, cols = 4 ) => {

    const [ samples, setSamples ] = useState( [] );
    const [ selectedSampleId, setSelectedSampleId ] = useState( null );
    const [ activeStep, setActiveStep ] = useState(-1);
    const [ isPlaying, setIsPlaying ] = useState(false);
    const [ bpm, setBpm ] = useState( 120 );
    const [ sampleStart, setSampleStart ] = useState(0);
    const [ lastTriggerTime, setLastTriggerTime ] = useState( 0 );

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
            buffer: newPlayer.buffer,
            chokeGroup: null
        }]);
        setSelectedSampleId(id);
    };

    const triggerSample = ( sampleId, time ) =>{
        const player = players.current[ sampleId ];
        const currentSamples = sampleRef.current;
        const sampleData = currentSamples.find( sample => sample.id === sampleId );

        if( player && player.loaded && sampleData ){

            // Choke Groups
            if( sampleData.chokeGroup !== null ){
                currentSamples.forEach( sample =>{
                    if (sample.chokeGroup === sampleData.chokeGroup && sample.id !== sampleId){
                        const otherPlayer = players.current[ sample.id];

                        if( otherPlayer ){
                            otherPlayer.stop( time );
                        }
                    }
                });
            }

            const offset = sampleData.startTime || 0;
            player.start( time, offset );

            // Update time for playhead
            setLastTriggerTime( isPlaying ? Tone.getTransport().seconds : Tone.now());
        }
    };

    const playSampleSolo = ( id ) =>{
        triggerSample(id, Tone.now());
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

    const tapBpm = () =>{
        const now = Tone.now();
        tapTimes.current.push(now);

        // Use last 4 taps
        if( tapTimes.current.length > 4 ){
            tapTimes.current.shift();
        }

        if( tapTimes.current.length > 1 ){
            const intervals = [];

            for( let i=1; i < tapTimes.current.length; i++ ){
                intervals.push(tapTimes.current[i] - tapTimes.current[i -1 ] );
            }

            const averageInterval = intervals.reduce((a, b ) => a + b) / intervals.length;

            const newBpm = Math.round(60 / averageInterval);

            if( newBpm > 30 && newBpm < 300 ){
                setBpm(newBpm);
            }
        }
        // Reset if user times out
        setTimeout(() =>{
            if( Tone.now() - tapTimes.current[ tapTimes.current.length - 1] > 2){
                tapTimes.current =  [];

            }
        }, 2000);
    };

    const doubleBpm = () =>{
        setBpm( prev =>{
            const doubled = prev * 2;
            return Math.min( doubled, 300 ); // Max 300bpm
        });
    };

    const halfBpm = () =>{
        setBpm( prev =>{
            const halved = prev / 2;
            return Math.max( halved, 30 ); // Min 30bpm
        });
    };

    const setChokeGroup = ( id, groupId ) =>{
        setSamples( prev => prev.map( sample =>
            sample.id === id ? { ...sample, chokeGroup : groupId === "none" ? null: parseInt(groupId )}: sample ));
    }
    const tapTimes = useRef([]);
    const sampleRef = useRef([]);

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

    useEffect(() =>{
        sampleRef.current = samples;
    }, [samples ]);

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

            if (cell?.isActive && padSampleId && playerToPlay?.loaded) {
                //const offset = sampleData ? sampleData.startTime : 0;
                //playerToPlay.start(time, offset);
                //setLastTriggerTime(Tone.getTransport().seconds);
                triggerSample(padSampleId, time);
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
        sampleStart,
        samples,
        selectedSampleId,
        setSelectedSampleId,
        lastTriggerTime,
        setChokeGroup,
        tapBpm,
        loadFile,
        playSampleSolo,
        setSampleStart: changeStartTime,
        captureCurrentMoment,
        doubleBpm,
        halfBpm,
    };
};