import { useCallback, useRef, createContext, useContext, useState, ReactNode } from 'react';

type SoundType = 'cardPlay' | 'cardDeal' | 'trickWon' | 'bidMade' | 'bidSet' | 'victory' | 'defeat' | 'yourTurn' | 'buttonClick' | 'shuffle' | 'catch5Slam' | 'pahtnahSlam';

const STORAGE_KEY = 'catch5-sound-muted';

interface SoundContextValue {
  playSound: (type: SoundType, tension?: number) => void;
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

  const playSound = useCallback((type: SoundType, tension: number = 0) => {
    if (isMuted) return;

    // Clamp tension to [0, 1]
    const t = Math.min(Math.max(tension, 0), 1);

    switch (type) {
      case 'cardPlay': {
        // Satisfying card slap sound — tension boosts volume +30%, filter 2500→3200Hz
        const volScale = 1 + t * 0.3;
        const filterFreq = 2500 + t * 700;
        playNoise(0.1, { volume: 0.35 * volScale, filterFreq, attack: 0.001, decay: 0.099 });
        playNoise(0.06, { volume: 0.2 * volScale, filterFreq: 600, filterType: 'bandpass', delay: 0.005 });
        playRichTone(150, 0.06, { type: 'triangle', volume: 0.15 * volScale, attack: 0.001, release: 0.04 });
        playRichTone(100, 0.04, { type: 'sine', volume: 0.1 * volScale, attack: 0.001, delay: 0.02 });
        // Sub-bass thump at tension > 0.5
        if (t > 0.5) {
          const subVol = (t - 0.5) * 0.4; // 0 → 0.2
          playRichTone(55, 0.12, { type: 'sine', volume: subVol, attack: 0.001, release: 0.1 });
        }
        break;
      }

      case 'cardDeal':
        // Quick card flip
        playNoise(0.07, { volume: 0.22, filterFreq: 3000, attack: 0.001, decay: 0.069 });
        playRichTone(250, 0.04, { type: 'triangle', volume: 0.1, attack: 0.001 });
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

      case 'trickWon': {
        // Satisfying sweep/collect sound — tension boosts volume +25%, adds detune spread
        const twVolScale = 1 + t * 0.25;
        const detune = t * 15; // 0 → ±15 cents
        playNoise(0.12, { volume: 0.12 * twVolScale, filterFreq: 1500, attack: 0.01, decay: 0.11 });
        playRichTone(440, 0.1, { volume: 0.2 * twVolScale, attack: 0.01, harmonics: [0.5, 0.25], detune: -detune });
        playRichTone(554, 0.1, { volume: 0.22 * twVolScale, delay: 0.08, attack: 0.01, harmonics: [0.5, 0.25], detune });
        playRichTone(659, 0.15, { volume: 0.25 * twVolScale, delay: 0.16, attack: 0.01, harmonics: [0.6, 0.3, 0.1], detune: -detune });
        break;
      }

      case 'bidMade': {
        // Triumphant fanfare for making the bid — tension boosts volume +20%
        const bmVolScale = 1 + t * 0.2;
        playRichTone(523, 0.12, { volume: 0.2 * bmVolScale, attack: 0.01, harmonics: [0.5, 0.25] });
        playRichTone(659, 0.12, { volume: 0.22 * bmVolScale, delay: 0.1, attack: 0.01, harmonics: [0.5, 0.25] });
        playRichTone(784, 0.12, { volume: 0.24 * bmVolScale, delay: 0.2, attack: 0.01, harmonics: [0.5, 0.25] });
        playChord([1047, 1319, 1568], 0.4, {
          volume: 0.28 * bmVolScale,
          delay: 0.35,
          stagger: 0.02,
          attack: 0.01
        });
        playNoise(0.2, { volume: 0.08 * bmVolScale, filterFreq: 6000, delay: 0.35 });
        break;
      }

      case 'bidSet': {
        // Dramatic descending "failure" sound — tension boosts volume +20%
        const bsVolScale = 1 + t * 0.2;
        playRichTone(440, 0.2, { volume: 0.25 * bsVolScale, harmonics: [0.4, 0.2], type: 'sine' });
        playRichTone(370, 0.22, { volume: 0.27 * bsVolScale, delay: 0.18, harmonics: [0.4, 0.2] });
        playRichTone(311, 0.25, { volume: 0.28 * bsVolScale, delay: 0.38, harmonics: [0.4, 0.2] });
        playChord([147, 185, 220], 0.5, {
          volume: 0.22 * bsVolScale,
          delay: 0.6,
          attack: 0.02,
          stagger: 0.03
        });
        // Add a low rumble for impact
        playRichTone(80, 0.4, { type: 'sine', volume: 0.15 * bsVolScale, delay: 0.6, attack: 0.05 });
        break;
      }

      case 'victory':
        // Grand victory fanfare
        const victoryNotes = [523, 659, 784, 1047];
        victoryNotes.forEach((freq, i) => {
          playRichTone(freq, 0.18, { 
            volume: 0.25 + i * 0.02, 
            delay: i * 0.1, 
            harmonics: [0.5, 0.3, 0.15],
            pan: (i - 1.5) * 0.15
          });
        });
        playChord([1047, 1319, 1568], 0.5, { 
          volume: 0.28, 
          delay: 0.5, 
          stagger: 0.015,
          attack: 0.01,
          type: 'sine'
        });
        playNoise(0.25, { volume: 0.1, filterFreq: 8000, delay: 0.5 });
        
        setTimeout(() => {
          playChord([1047, 1319, 1568, 2093], 0.7, { 
            volume: 0.3, 
            stagger: 0.01,
            attack: 0.01
          });
          playNoise(0.3, { volume: 0.08, filterFreq: 10000 });
        }, 700);
        break;

      case 'defeat':
        // Melancholic defeat sound
        playRichTone(440, 0.3, { volume: 0.22, harmonics: [0.3, 0.15], decay: 0.25 });
        playRichTone(370, 0.32, { volume: 0.24, delay: 0.28, harmonics: [0.3, 0.15] });
        playRichTone(311, 0.35, { volume: 0.25, delay: 0.58, harmonics: [0.35, 0.18] });
        playChord([147, 185, 220], 0.7, { 
          volume: 0.2, 
          delay: 0.9, 
          stagger: 0.04,
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

      case 'catch5Slam':
        // Low-frequency thump — the table impact
        playRichTone(80, 0.15, { type: 'sine', volume: 0.4, attack: 0.001, release: 0.12 });
        // Sharp noise burst — the card slap
        playNoise(0.08, { volume: 0.45, filterFreq: 1200, attack: 0.001, decay: 0.079 });
        // Rising power chord after impact — the "catch" payoff
        playChord([330, 415, 523], 0.3, {
          volume: 0.28,
          delay: 0.1,
          stagger: 0.015,
          attack: 0.01,
          type: 'sine'
        });
        // High shimmer noise — sparkle tail
        playNoise(0.15, { volume: 0.12, filterFreq: 8000, delay: 0.15, attack: 0.01 });
        break;

      case 'pahtnahSlam':
        // Heavy slam impact — low sine thump
        playRichTone(80, 0.18, { type: 'sine', volume: 0.45, attack: 0.001, release: 0.15 });
        // Card slap noise burst
        playNoise(0.1, { volume: 0.5, filterFreq: 1000, attack: 0.001, decay: 0.099 });
        // Quick ascending sting — C5-E5-G5 triumphant chord
        playChord([523, 659, 784], 0.35, {
          volume: 0.3,
          delay: 0.12,
          stagger: 0.02,
          attack: 0.01,
          type: 'sine'
        });
        // Bright shimmer tail
        playNoise(0.18, { volume: 0.14, filterFreq: 9000, delay: 0.18, attack: 0.01 });
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
