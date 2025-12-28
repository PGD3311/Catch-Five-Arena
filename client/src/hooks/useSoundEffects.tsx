import { useCallback, useRef, createContext, useContext, useState, ReactNode } from 'react';

type SoundType = 'cardPlay' | 'cardDeal' | 'trickWon' | 'bidMade' | 'bidSet' | 'victory' | 'defeat' | 'yourTurn' | 'buttonClick' | 'shuffle';

const STORAGE_KEY = 'catch5-sound-muted';

interface SoundContextValue {
  playSound: (type: SoundType) => void;
  isMuted: boolean;
  toggleMute: () => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    }
    return false;
  });

  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const createReverb = useCallback((ctx: AudioContext, duration: number = 0.3) => {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }
    
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }, []);

  const playRichTone = useCallback((
    frequency: number,
    duration: number,
    options: {
      type?: OscillatorType;
      volume?: number;
      delay?: number;
      attack?: number;
      decay?: number;
      sustain?: number;
      release?: number;
      harmonics?: number[];
      detune?: number;
      pan?: number;
    } = {}
  ) => {
    try {
      const ctx = getAudioContext();
      const {
        type = 'sine',
        volume = 0.3,
        delay = 0,
        attack = 0.01,
        decay = 0.1,
        sustain = 0.7,
        release = 0.1,
        harmonics = [],
        detune = 0,
        pan = 0
      } = options;

      const now = ctx.currentTime + delay;
      const masterGain = ctx.createGain();
      const panner = ctx.createStereoPanner();
      
      panner.pan.value = pan;
      masterGain.connect(panner);
      panner.connect(ctx.destination);

      const sustainTime = Math.max(0, duration - attack - decay - release);
      
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(volume, now + attack);
      masterGain.gain.linearRampToValueAtTime(volume * sustain, now + attack + decay);
      masterGain.gain.setValueAtTime(volume * sustain, now + attack + decay + sustainTime);
      masterGain.gain.linearRampToValueAtTime(0, now + duration);

      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      osc.detune.setValueAtTime(detune, now);
      osc.connect(masterGain);
      osc.start(now);
      osc.stop(now + duration + 0.1);

      harmonics.forEach((harmonic, i) => {
        const harmOsc = ctx.createOscillator();
        const harmGain = ctx.createGain();
        harmOsc.type = type;
        harmOsc.frequency.setValueAtTime(frequency * (i + 2), now);
        harmGain.gain.setValueAtTime(harmonic * volume, now);
        harmGain.gain.linearRampToValueAtTime(0, now + duration);
        harmOsc.connect(harmGain);
        harmGain.connect(masterGain);
        harmOsc.start(now);
        harmOsc.stop(now + duration + 0.1);
      });
    } catch (e) {
      // Audio context not available
    }
  }, [getAudioContext]);

  const playNoise = useCallback((
    duration: number,
    options: {
      volume?: number;
      filterFreq?: number;
      filterType?: BiquadFilterNode['type'];
      delay?: number;
      attack?: number;
      decay?: number;
    } = {}
  ) => {
    try {
      const ctx = getAudioContext();
      const {
        volume = 0.1,
        filterFreq = 2000,
        filterType = 'lowpass',
        delay = 0,
        attack = 0.005,
        decay = duration - 0.005
      } = options;

      const now = ctx.currentTime + delay;
      const bufferSize = Math.ceil(ctx.sampleRate * (duration + 0.1));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, now);
      filter.Q.setValueAtTime(1, now);

      source.buffer = buffer;
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume, now + attack);
      gainNode.gain.linearRampToValueAtTime(0, now + attack + decay);

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.start(now);
      source.stop(now + duration + 0.1);
    } catch (e) {
      // Audio context not available
    }
  }, [getAudioContext]);

  const playChord = useCallback((
    frequencies: number[],
    duration: number,
    options: {
      type?: OscillatorType;
      volume?: number;
      delay?: number;
      stagger?: number;
      attack?: number;
      release?: number;
    } = {}
  ) => {
    const { stagger = 0, ...rest } = options;
    frequencies.forEach((freq, i) => {
      playRichTone(freq, duration - (i * stagger), {
        ...rest,
        delay: (options.delay || 0) + (i * stagger),
        harmonics: [0.3, 0.15, 0.08]
      });
    });
  }, [playRichTone]);

  const playSound = useCallback((type: SoundType) => {
    if (isMuted) return;

    switch (type) {
      case 'cardPlay':
        playNoise(0.08, { volume: 0.25, filterFreq: 3000, attack: 0.002, decay: 0.078 });
        playNoise(0.04, { volume: 0.15, filterFreq: 800, filterType: 'bandpass', delay: 0.01 });
        playRichTone(180, 0.05, { type: 'triangle', volume: 0.12, attack: 0.002, release: 0.03 });
        break;

      case 'cardDeal':
        playNoise(0.06, { volume: 0.18, filterFreq: 2500, attack: 0.001, decay: 0.059 });
        playRichTone(220, 0.03, { type: 'triangle', volume: 0.08, attack: 0.001 });
        break;

      case 'shuffle':
        for (let i = 0; i < 8; i++) {
          playNoise(0.04, { 
            volume: 0.1 + Math.random() * 0.08, 
            filterFreq: 2000 + Math.random() * 1000, 
            delay: i * 0.05 + Math.random() * 0.02 
          });
        }
        break;

      case 'trickWon':
        playRichTone(523, 0.12, { volume: 0.22, attack: 0.01, harmonics: [0.4, 0.2] });
        playRichTone(659, 0.12, { volume: 0.24, delay: 0.1, attack: 0.01, harmonics: [0.4, 0.2] });
        playRichTone(784, 0.18, { volume: 0.28, delay: 0.2, attack: 0.01, harmonics: [0.5, 0.25, 0.1] });
        playNoise(0.08, { volume: 0.08, filterFreq: 4000, delay: 0.2 });
        break;

      case 'bidMade':
        playChord([523, 659, 784], 0.15, { volume: 0.18, stagger: 0.03, attack: 0.02 });
        playRichTone(1047, 0.35, { 
          volume: 0.28, 
          delay: 0.25, 
          attack: 0.02, 
          decay: 0.1,
          sustain: 0.6,
          release: 0.15,
          harmonics: [0.5, 0.3, 0.15] 
        });
        playNoise(0.15, { volume: 0.06, filterFreq: 6000, delay: 0.25 });
        break;

      case 'bidSet':
        playRichTone(392, 0.18, { volume: 0.22, harmonics: [0.3, 0.15], pan: -0.3 });
        playRichTone(311, 0.2, { volume: 0.24, delay: 0.15, harmonics: [0.3, 0.15] });
        playChord([196, 233, 294], 0.4, { 
          volume: 0.2, 
          delay: 0.32, 
          attack: 0.02,
          stagger: 0.02
        });
        break;

      case 'victory':
        const victoryNotes = [523, 659, 784, 1047];
        victoryNotes.forEach((freq, i) => {
          playRichTone(freq, 0.15, { 
            volume: 0.22 + i * 0.02, 
            delay: i * 0.12, 
            harmonics: [0.4, 0.2, 0.1],
            pan: (i - 1.5) * 0.2
          });
        });
        playChord([1047, 1319, 1568], 0.5, { 
          volume: 0.25, 
          delay: 0.55, 
          stagger: 0.02,
          attack: 0.02,
          type: 'sine'
        });
        playNoise(0.3, { volume: 0.08, filterFreq: 8000, delay: 0.55 });
        
        setTimeout(() => {
          playChord([1047, 1319, 1568, 2093], 0.6, { 
            volume: 0.28, 
            stagger: 0.015,
            attack: 0.01
          });
        }, 800);
        break;

      case 'defeat':
        playRichTone(392, 0.25, { volume: 0.2, harmonics: [0.25, 0.12], decay: 0.2 });
        playRichTone(330, 0.28, { volume: 0.22, delay: 0.22, harmonics: [0.25, 0.12] });
        playRichTone(277, 0.32, { volume: 0.24, delay: 0.48, harmonics: [0.3, 0.15] });
        playChord([196, 233, 277], 0.6, { 
          volume: 0.18, 
          delay: 0.78, 
          stagger: 0.03,
          attack: 0.03,
          type: 'sine'
        });
        break;

      case 'yourTurn':
        playRichTone(880, 0.1, { 
          volume: 0.18, 
          type: 'sine', 
          harmonics: [0.3, 0.15],
          attack: 0.01
        });
        playRichTone(1109, 0.12, { 
          volume: 0.22, 
          delay: 0.08, 
          type: 'sine', 
          harmonics: [0.4, 0.2],
          attack: 0.01
        });
        playRichTone(1319, 0.15, { 
          volume: 0.2, 
          delay: 0.18, 
          type: 'sine', 
          harmonics: [0.3],
          attack: 0.01
        });
        break;

      case 'buttonClick':
        playRichTone(800, 0.03, { type: 'square', volume: 0.06, attack: 0.001, release: 0.02 });
        playNoise(0.02, { volume: 0.04, filterFreq: 4000 });
        break;
    }
  }, [isMuted, playRichTone, playNoise, playChord]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newValue = !prev;
      localStorage.setItem(STORAGE_KEY, String(newValue));
      return newValue;
    });
  }, []);

  const value = { playSound, isMuted, toggleMute };

  return (
    <SoundContext.Provider value={value}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
}

export type { SoundType };
