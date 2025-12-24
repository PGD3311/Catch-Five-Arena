import { GameState, Card as CardType, Suit, Player, TrickCard } from '@shared/gameTypes';
import { PlayerArea } from './PlayerArea';
import { TrickArea } from './TrickArea';
import { GameHeader } from './GameHeader';
import { BiddingPanel } from './BiddingPanel';
import { TrumpSelector } from './TrumpSelector';
import { ScoreModal } from './ScoreModal';
import { SettingsPanel } from './SettingsPanel';
import { RulesModal } from './RulesModal';
import { ShareModal } from './ShareModal';
import { PurgeDrawModal } from './PurgeDrawModal';
import { DealerDrawModal } from './DealerDrawModal';
import { ActionPrompt } from './ActionPrompt';
import { TurnTimer } from './TurnTimer';
import { MultiplayerLobby } from './MultiplayerLobby';
import { LastTrickModal } from './LastTrickModal';
import { ChatPanel, FloatingEmoji, initAudioContext } from './ChatPanel';
import type { ChatMessage } from '@shared/gameTypes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { useToast } from '@/hooks/use-toast';
import { History } from 'lucide-react';
import {
  initializeGame,
  dealCards,
  processBid,
  selectTrump,
  playCard,
  canPlayCard,
  getCpuBid,
  getCpuTrumpChoice,
  getCpuCardToPlay,
  startNewRound,
  checkGameOver,
  performPurgeAndDraw,
  startDealerDraw,
  finalizeDealerDraw,
  determineTrickWinner,
  checkAutoClaim,
  applyAutoClaim,
} from '@shared/gameEngine';

export function GameBoard() {
  const [localGameState, setGameState] = useState<GameState>(() => initializeGame());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showPurgeDraw, setShowPurgeDraw] = useState(false);
  const [showDealerDraw, setShowDealerDraw] = useState(false);
  const [showMultiplayerLobby, setShowMultiplayerLobby] = useState(false);
  const [showLastTrick, setShowLastTrick] = useState(false);
  const [trickWinner, setTrickWinner] = useState<Player | null>(null);
  const [displayTrick, setDisplayTrick] = useState<TrickCard[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [floatingEmojis, setFloatingEmojis] = useState<ChatMessage[]>([]);
  const [timerKey, setTimerKey] = useState(0);
  const trickWinnerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevTrickRef = useRef<TrickCard[]>([]);
  const lastChatCountRef = useRef(0);
  const lastEmojiCountRef = useRef(0);
  const { toast } = useToast();

  const multiplayer = useMultiplayer();
  const isMultiplayerMode = !!multiplayer.roomCode;
  const gameState = isMultiplayerMode && multiplayer.gameState ? multiplayer.gameState : localGameState;
  const mySeatIndex = isMultiplayerMode ? (multiplayer.seatIndex ?? 0) : 0;
  
  // Track unread chat messages and floating emojis
  useEffect(() => {
    if (!isMultiplayerMode) return;
    const newCount = multiplayer.chatMessages.length;
    
    // Handle unread count
    if (newCount > lastChatCountRef.current && !isChatOpen) {
      setUnreadCount(prev => prev + (newCount - lastChatCountRef.current));
    }
    
    // Handle floating emojis from new messages
    if (newCount > lastEmojiCountRef.current) {
      const newMessages = multiplayer.chatMessages.slice(lastEmojiCountRef.current);
      const emojiMessages = newMessages.filter(m => m.type === 'emoji' && m.senderId !== gameState.players[mySeatIndex]?.id);
      
      if (emojiMessages.length > 0) {
        setFloatingEmojis(prev => [...prev, ...emojiMessages]);
      }
    }
    
    lastChatCountRef.current = newCount;
    lastEmojiCountRef.current = newCount;
  }, [multiplayer.chatMessages.length, isChatOpen, isMultiplayerMode, multiplayer.chatMessages, gameState.players, mySeatIndex]);
  
  // Remove a floating emoji by ID
  const removeFloatingEmoji = useCallback((id: string) => {
    setFloatingEmojis(prev => prev.filter(e => e.id !== id));
  }, []);
  
  // Reset unread count when opening chat, init audio context on user gesture
  const handleChatToggle = useCallback(() => {
    initAudioContext();
    if (!isChatOpen) {
      setUnreadCount(0);
    }
    setIsChatOpen(prev => !prev);
  }, [isChatOpen]);
  
  const handleSendChat = useCallback((content: string, type: 'text' | 'emoji') => {
    multiplayer.sendChat(content, type);
  }, [multiplayer]);
  
  // Debug logging for trick card positioning
  useEffect(() => {
    if (isMultiplayerMode && gameState.currentTrick.length > 0) {
      console.log('[GameBoard] Rendering tricks:', {
        mySeatIndex,
        multiplayerSeatIndex: multiplayer.seatIndex,
        currentTrick: gameState.currentTrick.map(tc => ({ playerId: tc.playerId, card: tc.card.rank + tc.card.suit })),
        playerIds: gameState.players.map(p => ({ id: p.id, name: p.name })),
      });
    }
  }, [isMultiplayerMode, gameState.currentTrick, mySeatIndex, multiplayer.seatIndex, gameState.players]);

  const handleTogglePlayerType = useCallback((playerId: string) => {
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => 
        p.id === playerId ? { ...p, isHuman: !p.isHuman } : p
      ),
    }));
  }, []);

  const handlePlayerNameChange = useCallback((playerId: string, name: string) => {
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => 
        p.id === playerId ? { ...p, name } : p
      ),
    }));
  }, []);


  const handleStartGame = useCallback(() => {
    if (isMultiplayerMode) {
      multiplayer.startGame();
    } else {
      setGameState(prev => startDealerDraw(prev));
      setShowDealerDraw(true);
    }
  }, [isMultiplayerMode, multiplayer]);

  const handleDealerDrawComplete = useCallback(() => {
    if (isMultiplayerMode) {
      multiplayer.sendAction('finalize_dealer_draw', {});
    } else {
      setShowDealerDraw(false);
      setGameState(prev => {
        const withDealer = finalizeDealerDraw(prev);
        return dealCards(withDealer);
      });
    }
  }, [isMultiplayerMode, multiplayer]);

  const handleBid = useCallback((bid: number) => {
    if (isMultiplayerMode) {
      multiplayer.sendAction('bid', { amount: bid });
    } else {
      setGameState(prev => processBid(prev, bid));
    }
  }, [isMultiplayerMode, multiplayer]);

  const handleTrumpSelect = useCallback((suit: Suit) => {
    if (isMultiplayerMode) {
      multiplayer.sendAction('select_trump', { suit });
    } else {
      setGameState(prev => ({
        ...prev,
        trumpSuit: suit,
        phase: 'purge-draw' as const,
      }));
      setShowPurgeDraw(true);
    }
  }, [isMultiplayerMode, multiplayer]);

  const handlePurgeDrawComplete = useCallback(() => {
    setShowPurgeDraw(false);
    if (isMultiplayerMode) {
      multiplayer.sendAction('purge_draw_complete', {});
    } else {
      setGameState(prev => performPurgeAndDraw(prev));
    }
  }, [isMultiplayerMode, multiplayer]);

  const handleCardPlay = useCallback((card: CardType) => {
    if (isMultiplayerMode) {
      multiplayer.sendAction('play_card', { card });
    } else {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!canPlayCard(card, currentPlayer.hand, gameState.currentTrick, gameState.trumpSuit)) {
        toast({
          title: "Invalid move",
          description: "You must follow suit or play trump!",
          variant: "destructive",
        });
        return;
      }
      
      const newTrick = [...gameState.currentTrick, { playerId: currentPlayer.id, card }];
      
      if (newTrick.length === 4 && gameState.trumpSuit) {
        setDisplayTrick(newTrick);
        
        if (trickWinnerTimeoutRef.current) {
          clearTimeout(trickWinnerTimeoutRef.current);
        }
        trickWinnerTimeoutRef.current = setTimeout(() => {
          setDisplayTrick([]);
          setGameState(prev => playCard(prev, card));
        }, 2500);
      } else {
        setGameState(prev => playCard(prev, card));
      }
    }
  }, [isMultiplayerMode, multiplayer, toast, gameState.players, gameState.currentPlayerIndex, gameState.currentTrick, gameState.trumpSuit]);

  const handleContinue = useCallback(() => {
    if (isMultiplayerMode) {
      multiplayer.sendAction('continue', {});
    } else {
      setGameState(prev => {
        if (checkGameOver(prev)) {
          return initializeGame(prev.deckColor, prev.targetScore);
        }
        return startNewRound(prev);
      });
    }
  }, [isMultiplayerMode, multiplayer]);

  const handleNewGame = useCallback(() => {
    setGameState(prev => initializeGame(prev.deckColor, prev.targetScore));
    setSettingsOpen(false);
  }, []);

  const handleSortHand = useCallback(() => {
    if (isMultiplayerMode) {
      multiplayer.sendAction('sort_hand', {});
    } else {
      const SUIT_ORDER: Record<string, number> = { 'Clubs': 0, 'Diamonds': 1, 'Hearts': 2, 'Spades': 3 };
      const RANK_ORDER: Record<string, number> = {
        'A': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6,
        '8': 7, '9': 8, '10': 9, 'J': 10, 'Q': 11, 'K': 12
      };
      
      setGameState(prev => ({
        ...prev,
        players: prev.players.map((p, idx) => {
          if (idx === mySeatIndex) {
            const sortedHand = [...p.hand].sort((a, b) => {
              const suitDiff = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
              if (suitDiff !== 0) return suitDiff;
              return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
            });
            return { ...p, hand: sortedHand };
          }
          return p;
        }),
      }));
    }
  }, [isMultiplayerMode, multiplayer, mySeatIndex]);

  useEffect(() => {
    return () => {
      if (trickWinnerTimeoutRef.current) {
        clearTimeout(trickWinnerTimeoutRef.current);
      }
    };
  }, []);

  // Multiplayer: Sync modal states with game phase
  useEffect(() => {
    if (!isMultiplayerMode) return;
    
    if (gameState.phase === 'purge-draw' && gameState.trumpSuit) {
      setShowPurgeDraw(true);
    } else if (gameState.phase !== 'purge-draw') {
      setShowPurgeDraw(false);
    }
  }, [isMultiplayerMode, gameState.phase, gameState.trumpSuit]);

  // Track the last shown lastTrick to avoid re-showing the same trick
  const lastShownTrickRef = useRef<string | null>(null);
  
  // Multiplayer: Capture completed tricks to display before transitioning
  useEffect(() => {
    if (!isMultiplayerMode) return;
    if (displayTrick.length > 0) return; // Already displaying a trick
    
    const prevTrick = prevTrickRef.current;
    const currentTrick = gameState.currentTrick;
    
    // Generate a unique ID for the current lastTrick
    const lastTrickId = gameState.lastTrick && gameState.lastTrick.length === 4
      ? gameState.lastTrick.map(tc => tc.card.id).join(',')
      : null;
    
    // Case 1: Trick just completed (was building, now reset)
    // Use lastTrick if available (server populates this when trick completes)
    if (prevTrick.length > 0 && currentTrick.length === 0 && gameState.lastTrick && gameState.lastTrick.length === 4) {
      console.log('[GameBoard] Case 1: Trick completed, showing lastTrick');
      setDisplayTrick(gameState.lastTrick);
      lastShownTrickRef.current = lastTrickId;
      
      if (trickWinnerTimeoutRef.current) {
        clearTimeout(trickWinnerTimeoutRef.current);
      }
      trickWinnerTimeoutRef.current = setTimeout(() => {
        setDisplayTrick([]);
      }, 2500);
    }
    // Case 2: We have exactly 4 cards in current trick (show it)
    else if (currentTrick.length === 4 && prevTrick.length < 4) {
      console.log('[GameBoard] Case 2: currentTrick has 4 cards');
      setDisplayTrick(currentTrick);
      
      if (trickWinnerTimeoutRef.current) {
        clearTimeout(trickWinnerTimeoutRef.current);
      }
      trickWinnerTimeoutRef.current = setTimeout(() => {
        setDisplayTrick([]);
      }, 2500);
    }
    // Case 3: Phase changed to scoring/game-over and we have a new lastTrick we haven't shown
    else if ((gameState.phase === 'scoring' || gameState.phase === 'game-over') && 
             gameState.lastTrick && gameState.lastTrick.length === 4 &&
             lastTrickId !== lastShownTrickRef.current) {
      console.log('[GameBoard] Case 3: Scoring phase with new lastTrick');
      setDisplayTrick(gameState.lastTrick);
      lastShownTrickRef.current = lastTrickId;
      
      if (trickWinnerTimeoutRef.current) {
        clearTimeout(trickWinnerTimeoutRef.current);
      }
      trickWinnerTimeoutRef.current = setTimeout(() => {
        setDisplayTrick([]);
      }, 2500);
    }
    
    // Update ref for next comparison
    prevTrickRef.current = currentTrick;
  }, [isMultiplayerMode, gameState.currentTrick, gameState.lastTrick, gameState.phase, displayTrick.length]);

  useEffect(() => {
    if (isMultiplayerMode) return;
    if (gameState.phase === 'bidding') {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!currentPlayer.isHuman) {
        // Slower bidding timing (1.0-1.5 seconds)
        const baseDelay = 1000 + Math.random() * 500;
        const timer = setTimeout(() => {
          const passedCount = gameState.players.filter(p => p.bid === 0).length;
          const isDealer = gameState.currentPlayerIndex === gameState.dealerIndex;
          const isLastAndAllPassed = isDealer && passedCount === 3;
          const cpuBid = getCpuBid(currentPlayer.hand, gameState.highBid, isDealer, isLastAndAllPassed);
          setGameState(prev => processBid(prev, cpuBid));
        }, baseDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.players, gameState.highBid, gameState.dealerIndex, isMultiplayerMode]);

  useEffect(() => {
    if (isMultiplayerMode) return;
    if (gameState.phase === 'trump-selection') {
      const bidder = gameState.players.find(p => p.id === gameState.bidderId);
      if (bidder && !bidder.isHuman) {
        // Slower trump selection timing (1.0-1.4 seconds)
        const timer = setTimeout(() => {
          // Check if dealer was forced to bid (all others passed, bid is minimum)
          const wasForcedBid = gameState.highBid === 5 && 
            gameState.players.filter(p => p.bid === 0).length === 3;
          const bestSuit = getCpuTrumpChoice(bidder.hand, wasForcedBid);
          handleTrumpSelect(bestSuit);
        }, 1000 + Math.random() * 400);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.phase, gameState.players, gameState.bidderId, gameState.highBid, isMultiplayerMode, handleTrumpSelect]);

  useEffect(() => {
    if (isMultiplayerMode) return;
    if (gameState.phase !== 'playing') return;
    // Don't process CPU turns while displaying a completed trick
    if (displayTrick.length > 0) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer.isHuman && currentPlayer.hand.length > 0) {
      // Slower, more deliberate timing for CPU plays (1.2-1.8 seconds)
      const baseDelay = 1200 + Math.random() * 600;
      const timer = setTimeout(() => {
        // Double-check we're still in playing phase and it's still this CPU's turn
        setGameState(prev => {
          if (prev.phase !== 'playing') return prev;
          if (prev.players[prev.currentPlayerIndex].isHuman) return prev;
          if (prev.players[prev.currentPlayerIndex].id !== currentPlayer.id) return prev;
          
          const cardToPlay = getCpuCardToPlay(
            prev.players[prev.currentPlayerIndex].hand,
            prev.currentTrick,
            prev.trumpSuit,
            currentPlayer.id,
            prev.players,
            prev.bidderId
          );
          
          const newTrick = [...prev.currentTrick, { playerId: currentPlayer.id, card: cardToPlay }];
          
          if (newTrick.length === 4 && prev.trumpSuit) {
            setDisplayTrick(newTrick);
            
            if (trickWinnerTimeoutRef.current) {
              clearTimeout(trickWinnerTimeoutRef.current);
            }
            trickWinnerTimeoutRef.current = setTimeout(() => {
              setDisplayTrick([]);
              setGameState(prevInner => playCard(prevInner, cardToPlay));
            }, 2500);
            return prev; // Don't update state yet - wait for displayTrick timeout
          } else {
            return playCard(prev, cardToPlay);
          }
        });
      }, baseDelay);
      return () => clearTimeout(timer);
    }
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.players, gameState.currentTrick, gameState.trumpSuit, isMultiplayerMode, displayTrick.length]);

  // Auto-claim disabled for now
  // useEffect(() => {
  //   if (isMultiplayerMode) return;
  //   if (gameState.phase !== 'playing') return;
  //   if (gameState.currentTrick.length !== 0) return;
  //   if (gameState.trickNumber <= 1) return;
  //   if (displayTrick.length > 0) return;
  //   
  //   const claim = checkAutoClaim(gameState.players, gameState.trumpSuit, gameState.stock);
  //   if (claim && claim.remainingTricks > 0) {
  //     const claimer = gameState.players.find(p => p.id === claim.claimerId);
  //     if (claimer) {
  //       toast({
  //         title: "Auto-Claim",
  //         description: `${claimer.name} claims remaining tricks with all remaining trumps!`,
  //       });
  //       
  //       setTimeout(() => {
  //         setGameState(prev => applyAutoClaim(prev, claim.claimerId));
  //       }, 1000);
  //     }
  //   }
  // }, [gameState.phase, gameState.currentTrick.length, gameState.trickNumber, gameState.players, gameState.trumpSuit, gameState.stock, isMultiplayerMode, displayTrick.length, toast]);

  const getRotatedIndex = (offset: number) => (mySeatIndex + offset) % 4;
  const humanPlayer = gameState.players[mySeatIndex];
  const partnerPlayer = gameState.players[getRotatedIndex(2)];
  const opponent1 = gameState.players[getRotatedIndex(1)];
  const opponent2 = gameState.players[getRotatedIndex(3)];
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = isMultiplayerMode 
    ? gameState.currentPlayerIndex === mySeatIndex 
    : currentPlayer?.isHuman;
  
  const passedCount = gameState.players.filter(p => p.bid === 0).length;
  const isDealer = gameState.currentPlayerIndex === gameState.dealerIndex;
  
  // Reset timer when turn changes
  useEffect(() => {
    setTimerKey(prev => prev + 1);
  }, [gameState.currentPlayerIndex, gameState.phase, gameState.trickNumber]);
  
  // Timer should be active during bidding and playing phases for human turns
  const timerActive = (gameState.phase === 'bidding' || gameState.phase === 'playing') && 
    isMyTurn && !currentPlayer?.isHuman === false;
  
  // Handle turn timeout - auto-pass in bidding, auto-play lowest card in playing
  const handleTurnTimeout = useCallback(() => {
    if (!isMyTurn) return;
    
    if (isMultiplayerMode) {
      // In multiplayer, notify user they timed out
      toast({
        title: "Time's up!",
        description: "You ran out of time. Making automatic move...",
        variant: "destructive",
      });
      
      if (gameState.phase === 'bidding') {
        // Auto-pass
        multiplayer.sendAction('bid', { amount: 0 });
      } else if (gameState.phase === 'playing') {
        // Auto-play first valid card
        const humanPlayer = gameState.players[mySeatIndex];
        const validCard = humanPlayer.hand.find(card => 
          canPlayCard(card, humanPlayer.hand, gameState.currentTrick, gameState.trumpSuit)
        );
        if (validCard) {
          multiplayer.sendAction('play_card', { card: validCard });
        }
      }
    } else {
      // In single player, auto-move
      if (gameState.phase === 'bidding') {
        setGameState(prev => processBid(prev, 0));
      } else if (gameState.phase === 'playing') {
        const humanPlayer = gameState.players[0];
        const validCard = humanPlayer.hand.find(card => 
          canPlayCard(card, humanPlayer.hand, gameState.currentTrick, gameState.trumpSuit)
        );
        if (validCard) {
          setGameState(prev => playCard(prev, validCard));
        }
      }
    }
  }, [isMyTurn, isMultiplayerMode, gameState.phase, gameState.players, gameState.currentTrick, gameState.trumpSuit, mySeatIndex, multiplayer, toast]);
  
  const showBiddingModal = gameState.phase === 'bidding' && isMyTurn;
  const amIBidder = gameState.bidderId === gameState.players[mySeatIndex]?.id;
  const showTrumpSelector = gameState.phase === 'trump-selection' && 
    (isMultiplayerMode ? amIBidder : gameState.players.find(p => p.id === gameState.bidderId)?.isHuman);
  // Delay score modal if we're still showing the final trick
  const showScoreModal = (gameState.phase === 'scoring' || gameState.phase === 'game-over') && displayTrick.length === 0;
  const showBidResults = gameState.phase === 'bidding' || gameState.phase === 'trump-selection' || gameState.phase === 'purge-draw';

  const getTeamForPlayer = (player: typeof humanPlayer) => 
    gameState.teams.find(t => t.id === player.teamId)!;

  // Get floating emoji for a player
  const getFloatingEmojiForPlayer = (playerId: string, position: 'left' | 'right' | 'top' | 'bottom') => {
    const emoji = floatingEmojis.find(e => e.senderId === playerId);
    if (!emoji) return null;
    return <FloatingEmoji key={emoji.id} emoji={emoji} senderPosition={position} onComplete={removeFloatingEmoji} />;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background game-table" data-testid="game-board">
      <GameHeader 
        gameState={gameState} 
        onSettingsClick={() => setSettingsOpen(true)}
        onShareClick={() => setShareOpen(true)}
        onRulesClick={() => setRulesOpen(true)}
        onLastTrickClick={() => setShowLastTrick(true)}
      />
      {gameState.phase === 'setup' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-10 p-8">
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-6xl font-bold tracking-tight gold-text dark:gold-text">
                Catch 5
              </h1>
              <p className="text-sm uppercase tracking-widest text-muted-foreground">Grab a pahtnah </p>
            </div>
            
          </div>
          {!showMultiplayerLobby ? (
            <>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" onClick={handleStartGame} className="px-8" data-testid="button-start-game">
                  Deal Cards
                </Button>
                <Button size="lg" variant="outline" onClick={() => setShowMultiplayerLobby(true)} data-testid="button-online-play">
                  Online Play
                </Button>
              </div>
              <Button variant="ghost" onClick={() => setRulesOpen(true)} data-testid="button-how-to-play">
                How to Play
              </Button>
              <p className="text-xs text-muted-foreground">
                Open Settings to configure players and deck colors
              </p>
            </>
          ) : (
            <MultiplayerLobby
              connected={multiplayer.connected}
              roomCode={multiplayer.roomCode}
              seatIndex={multiplayer.seatIndex}
              players={multiplayer.players}
              error={multiplayer.error}
              onCreateRoom={multiplayer.createRoom}
              onJoinRoom={multiplayer.joinRoom}
              onStartGame={multiplayer.startGame}
              onLeaveRoom={() => {
                multiplayer.leaveRoom();
                setShowMultiplayerLobby(false);
              }}
              onClose={() => setShowMultiplayerLobby(false)}
              onAddCpu={multiplayer.addCpu}
              onRemoveCpu={multiplayer.removeCpu}
              onSwapSeats={multiplayer.swapSeats}
              onRandomizeTeams={multiplayer.randomizeTeams}
              deckColor={localGameState.deckColor}
              targetScore={localGameState.targetScore}
            />
          )}
        </div>
      )}
      {gameState.phase !== 'setup' && gameState.phase !== 'dealer-draw' && (
        isMultiplayerMode && multiplayer.seatIndex === null ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Connecting to game...</p>
          </div>
        ) : (
        <div className="flex-1 flex flex-col p-2 sm:p-4 md:p-6 gap-2 sm:gap-4 overflow-hidden">
          <div className="flex justify-center relative">
            {getFloatingEmojiForPlayer(partnerPlayer.id, 'top')}
            <PlayerArea
              player={partnerPlayer}
              team={getTeamForPlayer(partnerPlayer)}
              isCurrentPlayer={gameState.currentPlayerIndex === getRotatedIndex(2)}
              isBidder={gameState.bidderId === partnerPlayer.id}
              isDealer={gameState.dealerIndex === getRotatedIndex(2)}
              deckColor={gameState.deckColor}
              position="top"
              showBidResult={showBidResults}
              trumpSuit={gameState.trumpSuit}
            />
          </div>

          <div className="flex-1 flex items-center justify-center gap-2 sm:gap-4">
            {/* Left player chip */}
            <div className="shrink-0 relative">
              {getFloatingEmojiForPlayer(opponent1.id, 'left')}
              <PlayerArea
                player={opponent1}
                team={getTeamForPlayer(opponent1)}
                isCurrentPlayer={gameState.currentPlayerIndex === getRotatedIndex(1)}
                isBidder={gameState.bidderId === opponent1.id}
                isDealer={gameState.dealerIndex === getRotatedIndex(1)}
                deckColor={gameState.deckColor}
                position="left"
                showBidResult={showBidResults}
                trumpSuit={gameState.trumpSuit}
              />
            </div>

            {/* Center area - minimal and clean */}
            <div className="flex-1 flex flex-col items-center justify-center max-w-xs sm:max-w-md">
              <TrickArea 
                currentTrick={displayTrick.length > 0 ? displayTrick : gameState.currentTrick} 
                players={gameState.players} 
                trumpSuit={gameState.trumpSuit}
                mySeatIndex={mySeatIndex}
              />
              
              {/* Timer and context line */}
              <div className="mt-1 flex flex-col items-center gap-1">
                {(gameState.phase === 'bidding' || gameState.phase === 'playing') && (
                  <TurnTimer
                    key={timerKey}
                    isActive={isMyTurn}
                    duration={20}
                    onTimeout={handleTurnTimeout}
                    playerName={currentPlayer?.name}
                    isCurrentPlayer={isMyTurn}
                  />
                )}
                <div className="flex items-center gap-2">
                  <ActionPrompt gameState={gameState} />
                  
                  {gameState.lastTrick && gameState.lastTrick.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLastTrick(true)}
                      className="h-6 px-2 text-[10px] text-muted-foreground"
                      data-testid="button-last-trick"
                    >
                      <History className="w-3 h-3 mr-1" />
                      Last
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Right player chip */}
            <div className="shrink-0 relative">
              {getFloatingEmojiForPlayer(opponent2.id, 'right')}
              <PlayerArea
                player={opponent2}
                team={getTeamForPlayer(opponent2)}
                isCurrentPlayer={gameState.currentPlayerIndex === getRotatedIndex(3)}
                isBidder={gameState.bidderId === opponent2.id}
                isDealer={gameState.dealerIndex === getRotatedIndex(3)}
                deckColor={gameState.deckColor}
                position="right"
                showBidResult={showBidResults}
                trumpSuit={gameState.trumpSuit}
              />
            </div>
          </div>

          {/* Bottom player area with bidding panel above cards */}
          <div className="flex flex-col items-center gap-2">
            {showBiddingModal && (
              <BiddingPanel
                open={showBiddingModal}
                highBid={gameState.highBid}
                playerName={humanPlayer.name}
                isDealer={isDealer}
                allOthersPassed={passedCount === 3}
                onBid={handleBid}
              />
            )}
            <PlayerArea
              player={humanPlayer}
              team={getTeamForPlayer(humanPlayer)}
              isCurrentPlayer={gameState.currentPlayerIndex === mySeatIndex}
              isBidder={gameState.bidderId === humanPlayer.id}
              isDealer={gameState.dealerIndex === mySeatIndex}
              deckColor={gameState.deckColor}
              onCardClick={isMyTurn && gameState.phase === 'playing' ? handleCardPlay : undefined}
              canPlayCard={(card) => isMyTurn && canPlayCard(card, humanPlayer.hand, gameState.currentTrick, gameState.trumpSuit)}
              position="bottom"
              showCards
              showBidResult={showBidResults}
              trumpSuit={gameState.trumpSuit}
              onSortHand={handleSortHand}
            />
          </div>
        </div>
        )
      )}
      <TrumpSelector
        open={showTrumpSelector || false}
        onSelect={handleTrumpSelect}
      />
      <PurgeDrawModal
        open={showPurgeDraw}
        players={gameState.players}
        trumpSuit={gameState.trumpSuit || 'Hearts'}
        onComplete={handlePurgeDrawComplete}
      />
      <ScoreModal
        open={showScoreModal}
        teams={gameState.teams}
        players={gameState.players}
        roundScores={gameState.roundScores}
        roundScoreDetails={gameState.roundScoreDetails}
        bidderId={gameState.bidderId}
        highBid={gameState.highBid}
        onContinue={handleContinue}
        isGameOver={checkGameOver(gameState)}
        targetScore={gameState.targetScore}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        deckColor={gameState.deckColor}
        onDeckColorChange={(color) => setGameState(prev => ({ ...prev, deckColor: color }))}
        onNewGame={handleNewGame}
        onShowRules={() => {
          setSettingsOpen(false);
          setRulesOpen(true);
        }}
        playerConfigs={gameState.players.map(p => ({ id: p.id, name: p.name, isHuman: p.isHuman }))}
        onTogglePlayerType={handleTogglePlayerType}
        onPlayerNameChange={handlePlayerNameChange}
      />
      <ShareModal 
        open={shareOpen} 
        onClose={() => setShareOpen(false)} 
        roomCode={multiplayer.roomCode}
      />
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <DealerDrawModal
        open={isMultiplayerMode ? gameState.phase === 'dealer-draw' : showDealerDraw}
        players={gameState.players}
        dealerDrawCards={gameState.dealerDrawCards || []}
        onComplete={handleDealerDrawComplete}
        deckColor={gameState.deckColor}
      />
      <LastTrickModal
        open={showLastTrick}
        onClose={() => setShowLastTrick(false)}
        lastTrick={gameState.lastTrick || []}
        players={gameState.players}
        winnerId={gameState.lastTrickWinnerId || null}
        trumpSuit={gameState.trumpSuit}
      />
      {isMultiplayerMode && gameState.phase !== 'setup' && gameState.players[mySeatIndex] && (
        <ChatPanel
          messages={multiplayer.chatMessages}
          onSendMessage={handleSendChat}
          currentPlayerId={gameState.players[mySeatIndex].id}
          isOpen={isChatOpen}
          onToggle={handleChatToggle}
          unreadCount={unreadCount}
        />
      )}
    </div>
  );
}
