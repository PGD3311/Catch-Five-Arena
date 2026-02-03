import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, X, ThumbsUp, ThumbsDown, Laugh, Angry, Heart, Flame, HandMetal, Brain } from 'lucide-react';
import type { ChatMessage, QuickEmojiId } from '@shared/gameTypes';
import { QUICK_EMOJIS } from '@shared/gameTypes';

const EMOJI_ICONS: Record<string, typeof ThumbsUp> = {
  ThumbsUp,
  ThumbsDown,
  Laugh,
  Angry,
  Heart,
  Flame,
  HandMetal,
  Brain,
};

const MAX_CHARS = 200;

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Shared audio context for notification sounds
let sharedAudioContext: AudioContext | null = null;
let audioContextReady = false;

// Initialize audio context on user gesture
export function initAudioContext() {
  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextReady = true;
    } catch (e) {
      // Audio not supported
    }
  } else if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().then(() => {
      audioContextReady = true;
    });
  }
}

function playNotificationSound() {
  if (!sharedAudioContext || !audioContextReady) return;
  
  try {
    const oscillator = sharedAudioContext.createOscillator();
    const gainNode = sharedAudioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(sharedAudioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.1, sharedAudioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, sharedAudioContext.currentTime + 0.1);
    
    oscillator.start(sharedAudioContext.currentTime);
    oscillator.stop(sharedAudioContext.currentTime + 0.1);
  } catch (e) {
    // Audio playback failed
  }
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, type: 'text' | 'emoji') => void;
  currentPlayerId: string;
  isOpen: boolean;
  onToggle: () => void;
  unreadCount: number;
}

export function ChatPanel({ 
  messages, 
  onSendMessage, 
  currentPlayerId, 
  isOpen, 
  onToggle,
  unreadCount 
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Auto-scroll and handle new message notifications
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    
    // Play sound for new messages from others
    if (messages.length > prevMessageCountRef.current) {
      const newMessages = messages.slice(prevMessageCountRef.current);
      const hasNewFromOthers = newMessages.some(m => m.senderId !== currentPlayerId);
      if (hasNewFromOthers && !isOpen) {
        playNotificationSound();
      }
      
      // Track new message IDs for animation
      const newIds = newMessages.map(m => m.id);
      setNewMessageIds(prev => new Set([...Array.from(prev), ...newIds]));
      
      // Clear animation after delay
      setTimeout(() => {
        setNewMessageIds(prev => {
          const updated = new Set(Array.from(prev));
          newIds.forEach(id => updated.delete(id));
          return updated;
        });
      }, 500);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, isOpen, currentPlayerId]);

  // Auto-focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSendText = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim(), 'text');
      setInputValue('');
    }
  };

  const handleSendEmoji = (emojiId: QuickEmojiId) => {
    onSendMessage(emojiId, 'emoji');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const getEmojiIcon = (emojiId: string) => {
    const emoji = QUICK_EMOJIS.find(e => e.id === emojiId);
    if (emoji) {
      const IconComponent = EMOJI_ICONS[emoji.icon];
      if (IconComponent) {
        return <IconComponent className="w-6 h-6" />;
      }
    }
    return <span className="text-lg">{emojiId}</span>;
  };

  if (!isOpen) {
    return (
      <Button
        size="icon"
        variant="outline"
        onClick={onToggle}
        className="fixed bottom-24 right-4 z-[100] rounded-full shadow-lg h-12 w-12"
        data-testid="button-open-chat"
      >
        <MessageCircle className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-80 bg-card border rounded-xl shadow-xl flex flex-col" style={{ maxHeight: '400px' }}>
      <div className="flex items-center justify-between gap-2 p-3 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Chat</span>
        </div>
        <Button size="icon" variant="ghost" onClick={onToggle} data-testid="button-close-chat">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3" style={{ minHeight: '200px', maxHeight: '250px' }}>
        <div ref={scrollRef} className="space-y-2">
          {messages.length === 0 ? (
            <div className="text-center py-6">
              <MessageCircle className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground text-sm">No messages yet</p>
              <p className="text-muted-foreground/70 text-xs mt-1">Say hi to your opponents!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === currentPlayerId;
              const isNew = newMessageIds.has(msg.id);
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isNew ? 'animate-in slide-in-from-bottom-2 duration-300' : ''}`}
                  data-testid={`chat-message-${msg.id}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      isMe
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className={`flex items-center gap-2 ${isMe ? 'justify-end' : 'justify-between'}`}>
                      {!isMe && (
                        <span className="text-xs font-medium opacity-70">{msg.senderName}</span>
                      )}
                      <span className={`text-[10px] opacity-50 ${isMe ? '' : ''}`}>
                        {formatTimestamp(msg.timestamp)}
                      </span>
                    </div>
                    {msg.type === 'emoji' ? (
                      <div className="flex items-center justify-center py-1">
                        {getEmojiIcon(msg.content)}
                      </div>
                    ) : (
                      <p className="text-sm break-words">{msg.content}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="p-2 border-t space-y-2">
        <div className="flex gap-1 justify-center flex-wrap">
          {QUICK_EMOJIS.map((emoji) => {
            const IconComponent = EMOJI_ICONS[emoji.icon];
            return (
              <Button
                key={emoji.id}
                size="icon"
                variant="ghost"
                className="w-8 h-8"
                onClick={() => handleSendEmoji(emoji.id)}
                title={emoji.label}
                data-testid={`button-emoji-${emoji.id}`}
              >
                {IconComponent && <IconComponent className="w-4 h-4" />}
              </Button>
            );
          })}
        </div>
        <div className="space-y-1">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1"
              maxLength={MAX_CHARS}
              data-testid="input-chat-message"
            />
            <Button size="icon" onClick={handleSendText} disabled={!inputValue.trim()} data-testid="button-send-chat">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex justify-end">
            <span className={`text-[10px] ${inputValue.length > MAX_CHARS - 20 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {inputValue.length}/{MAX_CHARS}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FloatingEmojiProps {
  emoji: ChatMessage;
  senderPosition: 'left' | 'right' | 'top' | 'bottom';
  onComplete: (id: string) => void;
}

export function FloatingEmoji({ emoji, senderPosition, onComplete }: FloatingEmojiProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete(emoji.id);
    }, 2500);
    return () => clearTimeout(timer);
  }, [emoji.id, onComplete]);

  if (!visible) return null;

  const emojiDef = QUICK_EMOJIS.find(e => e.id === emoji.content);
  const IconComponent = emojiDef ? EMOJI_ICONS[emojiDef.icon] : null;

  const positionClasses: Record<string, string> = {
    left: 'left-16 top-1/2 -translate-y-1/2',
    right: 'right-16 top-1/2 -translate-y-1/2',
    top: 'top-16 left-1/2 -translate-x-1/2',
    bottom: 'bottom-16 left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={`absolute ${positionClasses[senderPosition]} z-40 animate-bounce`}
      style={{ animationDuration: '0.5s' }}
    >
      <div className="bg-card/90 backdrop-blur-sm rounded-full p-3 shadow-lg border">
        {IconComponent ? (
          <IconComponent className="w-8 h-8 text-primary" />
        ) : (
          <span className="text-2xl">{emoji.content}</span>
        )}
      </div>
    </div>
  );
}
