import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface PahtnahSlamProps {
  onComplete: () => void;
  onShake?: () => void;
}

// Stable keyframe refs — prevents Framer Motion replays on re-render
const TEXT_SCALE = [0, 1.25, 1];
const TEXT_OPACITY = [0, 1, 1, 0];
const TEXT_TIMES = [0, 0.1, 0.6, 1];
const RING_INITIAL = { scale: 0, opacity: 0.7 };
const RING_ANIMATE = { scale: 4, opacity: 0 };

export function PahtnahSlam({ onComplete, onShake }: PahtnahSlamProps) {
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;
  const firedRef = useRef(false);

  useEffect(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      onShakeRef.current?.();
    }
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 50 }}>
      {/* Outer ripple ring */}
      <motion.div
        initial={RING_INITIAL}
        animate={RING_ANIMATE}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="absolute rounded-full"
        style={{
          width: 60,
          height: 60,
          border: '2px solid hsl(42, 82%, 58%)',
          boxShadow: '0 0 20px hsl(42 82% 58% / 0.3)',
        }}
      />

      {/* Inner ripple ring — staggered */}
      <motion.div
        initial={RING_INITIAL}
        animate={RING_ANIMATE}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.08 }}
        className="absolute rounded-full"
        style={{
          width: 50,
          height: 50,
          border: '2.5px solid hsl(42, 90%, 65%)',
          boxShadow: '0 0 14px hsl(42 90% 65% / 0.35)',
        }}
      />

      {/* "THAT'S MY PAHTNAH!" text */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: TEXT_SCALE, opacity: TEXT_OPACITY }}
        transition={{
          duration: 2.2,
          times: TEXT_TIMES,
          scale: { type: 'spring', stiffness: 400, damping: 20 },
        }}
        onAnimationComplete={() => onComplete()}
        className="absolute gold-text"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(0.9rem, 3.5vw, 1.8rem)',
          fontWeight: 800,
          letterSpacing: '0.06em',
          textShadow: '0 0 24px hsl(42 82% 58% / 0.6)',
          top: '-2.8rem',
          whiteSpace: 'nowrap',
        }}
      >
        THAT'S MY PAHTNAH!
      </motion.div>
    </div>
  );
}
