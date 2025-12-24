import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TurnTimerProps {
  isActive: boolean;
  duration?: number;
  onTimeout?: () => void;
  playerName?: string;
  isCurrentPlayer?: boolean;
}

export function TurnTimer({ 
  isActive, 
  duration = 20, 
  onTimeout,
  playerName,
  isCurrentPlayer = false
}: TurnTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isWarning, setIsWarning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasTimedOut = useRef(false);

  useEffect(() => {
    if (isActive) {
      setTimeLeft(duration);
      setIsWarning(false);
      hasTimedOut.current = false;
      
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          if (newTime <= 5) {
            setIsWarning(true);
          }
          if (newTime <= 0 && !hasTimedOut.current) {
            hasTimedOut.current = true;
            onTimeout?.();
            return 0;
          }
          return Math.max(0, newTime);
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, duration, onTimeout]);

  if (!isActive) return null;

  const percentage = (timeLeft / duration) * 100;
  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-2" data-testid="turn-timer">
      <div className="relative w-10 h-10">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-muted-foreground/20"
          />
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={cn(
              "transition-all duration-1000 ease-linear",
              isWarning ? "text-destructive" : "text-primary"
            )}
          />
        </svg>
        <span 
          className={cn(
            "absolute inset-0 flex items-center justify-center text-sm font-bold",
            isWarning ? "text-destructive animate-pulse" : "text-foreground"
          )}
        >
          {timeLeft}
        </span>
      </div>
      {playerName && (
        <span className={cn(
          "text-sm font-medium",
          isCurrentPlayer ? "text-primary" : "text-muted-foreground"
        )}>
          {isCurrentPlayer ? "Your turn" : `${playerName}'s turn`}
        </span>
      )}
    </div>
  );
}
