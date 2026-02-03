import { GameState, Card as CardType, Suit, Player, TrickCard, TOTAL_TRICKS } from '@shared/gameTypes';
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
import { ConnectionStatus } from './ConnectionStatus';
import { LastTrickModal } from './LastTrickModal';
import { HomeScreen } from './HomeScreen';
import { StatsPage } from './StatsPage';
import { ChatPanel, FloatingEmoji, initAudioContext } from './ChatPanel';
import type { ChatMessage } from '@shared/gameTypes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { useCpuTurns } from '@/hooks/useCpuTurns';
import { useToast } from '@/hooks/use-toast';
import { useSound } from '@/hooks/useSoundEffects';
import { TensionProvider } from '@/hooks/useTension';
import { computeTension } from '@shared/tensionEngine';
import { History, Eye } from 'lucide-react';
import {
  initializeGame,
  dealCards,
  processBid,
  playCard,
  canPlayCard,
  startNewRound,
  checkGameOver,
  performPurgeAndDraw,
  discardTrumpCard,
  startDealerDraw,
  finalizeDealerDraw,
} from '@shared/gameEngine';

export function GameBoard() {
  const [localGameState, setGameState] = useState<GameState>(() => initializeGame());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showPurgeDraw, setShowPurgeDraw] = useState(false);
  const [showDealerDraw, setShowDealerDraw] = useState(false);
  const [showMultiplayerLobby, setShowMultiplayerLobby] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showLastTrick, setShowLastTrick] = useState(false);
  const [trickWinner, setTrickWinner] = useState<Player | null>(null);
  const [displayTrick, setDisplayTrick] = useState<TrickCard[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [floatingEmojis, setFloatingEmojis] = useState<ChatMessage[]>([]);
  const [screenShake, setScreenShake] = useState(false);
  const trickWinnerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevTrickRef = useRef<TrickCard[]>([]);
  const lastChatCountRef = useRef(0);
  const lastEmojiCountRef = useRef(0);
  const { toast } = useToast();

  const multiplayer = useMultiplayer();
  const { playSound } = useSound();
  const isMultiplayerMode = !!multiplayer.roomCode;
  const isSpectating = multiplayer.isSpectating;
  const gameState = isMultiplayerMode && multiplayer.gameState ? multiplayer.gameState : localGameState;
  const mySeatIndex = isSpectating ? 0 : (isMultiplayerMode ? (multiplayer.seatIndex ?? 0) : 0);
  
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

  const handleCatch5Shake = useCallback(() => {
    playSound('catch5Slam');
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 400);
  }, [playSound]);
  
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
    playSound('cardPlay', computeTension(gameState));
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
        // Play trick won sound after a short delay
        const trickTension = computeTension(gameState);
        setTimeout(() => playSound('trickWon', trickTension), 300);
        
        if (trickWinnerTimeoutRef.current) {
          clearTimeout(trickWinnerTimeoutRef.current);
        }
        const trickHold = gameState.trickNumber >= TOTAL_TRICKS ? 3500 : 2500;
        trickWinnerTimeoutRef.current = setTimeout(() => {
          setDisplayTrick([]);
          setGameState(prev => playCard(prev, card));
        }, trickHold);
      } else {
        setGameState(prev => playCard(prev, card));
      }
    }
  }, [isMultiplayerMode, multiplayer, toast, gameState.players, gameState.currentPlayerIndex, gameState.currentTrick, gameState.trumpSuit, gameState.trickNumber, playSound]);

  const handleDiscardTrump = useCallback((card: CardType) => {
    if (isMultiplayerMode) {
      multiplayer.sendAction('discard_trump', { card });
    } else {
      setGameState(prev => discardTrumpCard(prev, card));
    }
  }, [isMultiplayerMode, multiplayer]);

  const handleContinue = useCallback(() => {
    if (isSpectating) return; // Spectators cannot advance the game
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
  }, [isMultiplayerMode, isSpectating, multiplayer]);

  const handleNewGame = useCallback(() => {
    setGameState(prev => initializeGame(prev.deckColor, prev.targetScore));
    setSettingsOpen(false);
  }, []);



  const handleExitGame = useCallback(() => {
    if (isSpectating) {
      multiplayer.leaveSpectate();
    } else if (isMultiplayerMode) {
      multiplayer.leaveRoom();
    }
    setGameState(prev => initializeGame(prev.deckColor, prev.targetScore));
    setSettingsOpen(false);
    setShowMultiplayerLobby(true);
  }, [isMultiplayerMode, isSpectating, multiplayer]);

  const handleSortHand = useCallback(() => {
    if (isMultiplayerMode) {
      multiplayer.sendAction('sort_hand', {});
    } else {
      const trumpSuit = gameState.trumpSuit;
      const SUIT_BASE: Record<string, number> = { 'Spades': 0, 'Hearts': 1, 'Clubs': 2, 'Diamonds': 3 };
      const RANK_ORDER: Record<string, number> = {
        'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8,
        '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
      };

      setGameState(prev => ({
        ...prev,
        players: prev.players.map((p, idx) => {
          if (idx === mySeatIndex) {
            const sortedHand = [...p.hand].sort((a, b) => {
              const aIsTrump = trumpSuit && a.suit === trumpSuit ? 0 : 1;
              const bIsTrump = trumpSuit && b.suit === trumpSuit ? 0 : 1;
              if (aIsTrump !== bIsTrump) return aIsTrump - bIsTrump;
              const suitDiff = SUIT_BASE[a.suit] - SUIT_BASE[b.suit];
              if (suitDiff !== 0) return suitDiff;
              return RANK_ORDER[b.rank] - RANK_ORDER[a.rank];
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

    const prevTrick = prevTrickRef.current;
    const currentTrick = gameState.currentTrick;

    // Always update ref so trick tracking stays current even during animation display
    prevTrickRef.current = currentTrick;

    if (displayTrick.length > 0) return; // Already displaying a trick
    
    // Generate a unique ID for the current lastTrick
    const lastTrickId = gameState.lastTrick && gameState.lastTrick.length === 4
      ? gameState.lastTrick.map(tc => tc.card.id).join(',')
      : null;
    
    // Final trick gets longer display hold (3500ms vs 2500ms)
    const mpTrickHold = gameState.trickNumber >= TOTAL_TRICKS ? 3500 : 2500;

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
      }, mpTrickHold);
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
      }, mpTrickHold);
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
      }, mpTrickHold);
    }
  }, [isMultiplayerMode, gameState.currentTrick, gameState.lastTrick, gameState.phase, gameState.trickNumber, displayTrick.length]);

  // CPU turn scheduling (bidding, trump selection, discard, card play)
  useCpuTurns({
    gameState,
    setGameState,
    isMultiplayerMode,
    displayTrick,
    setDisplayTrick,
    trickWinnerTimeoutRef,
    handleTrumpSelect,
  });

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
  const isMyTurn = isSpectating
    ? false
    : isMultiplayerMode
      ? gameState.currentPlayerIndex === mySeatIndex
      : currentPlayer?.isHuman;
  
  const passedCount = gameState.players.filter(p => p.bid === 0).length;
  const isDealer = gameState.currentPlayerIndex === gameState.dealerIndex;
  
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
  
  const showBiddingModal = !isSpectating && gameState.phase === 'bidding' && isMyTurn;
  const amIBidder = !isSpectating && gameState.bidderId === gameState.players[mySeatIndex]?.id;
  const showTrumpSelector = !isSpectating && gameState.phase === 'trump-selection' &&
    (isMultiplayerMode ? amIBidder : gameState.players.find(p => p.id === gameState.bidderId)?.isHuman);
  // Delay score modal if we're still showing the final trick
  const showScoreModal = (gameState.phase === 'scoring' || gameState.phase === 'game-over') && displayTrick.length === 0;
  const showBidResults = gameState.phase === 'bidding' || gameState.phase === 'trump-selection' || gameState.phase === 'purge-draw';

  // Compute dramatic reveal: bid 8+ AND bidding team captured the Five of trump
  const isDramaticReveal = (() => {
    if (gameState.highBid < 8) return false;
    if (!gameState.roundScoreDetails?.five) return false;
    const bidderTeam = gameState.teams.find(t =>
      gameState.players.find(p => p.id === gameState.bidderId)?.teamId === t.id
    );
    return bidderTeam ? gameState.roundScoreDetails.five.teamId === bidderTeam.id : false;
  })();

  // Hide header scores during dramatic reveal — from the moment scoring phase
  // starts (even while final trick is still displaying) until after the hold
  const isScoringPhase = gameState.phase === 'scoring' || gameState.phase === 'game-over';
  const [hideHeaderScores, setHideHeaderScores] = useState(false);
  const dramaticHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (isScoringPhase && isDramaticReveal) {
      setHideHeaderScores(true);
    }
  }, [isScoringPhase, isDramaticReveal]);

  // Once the score modal actually opens, start the 1800ms hold timer
  useEffect(() => {
    if (showScoreModal && isDramaticReveal && hideHeaderScores) {
      dramaticHoldTimerRef.current = setTimeout(() => setHideHeaderScores(false), 1800);
      return () => {
        if (dramaticHoldTimerRef.current) clearTimeout(dramaticHoldTimerRef.current);
      };
    }
  }, [showScoreModal, isDramaticReveal, hideHeaderScores]);

  // Reset when leaving scoring phase
  useEffect(() => {
    if (!isScoringPhase) {
      setHideHeaderScores(false);
      if (dramaticHoldTimerRef.current) {
        clearTimeout(dramaticHoldTimerRef.current);
        dramaticHoldTimerRef.current = null;
      }
    }
  }, [isScoringPhase]);

  // Play sounds when score modal opens
  const prevShowScoreModalRef = useRef(false);
  useEffect(() => {
    if (showScoreModal && !prevShowScoreModalRef.current) {
      const isGameOverNow = checkGameOver(gameState);
      const bidderTeam = gameState.teams.find(t =>
        gameState.players.find(p => p.id === gameState.bidderId)?.teamId === t.id
      );
      const bidderTeamScore = bidderTeam ? gameState.roundScores[bidderTeam.id] || 0 : 0;
      const bidderMadeIt = bidderTeamScore >= gameState.highBid;
      const isBidderYourTeam = bidderTeam?.id === 'team1';
      const isGoodForYou = isBidderYourTeam ? bidderMadeIt : !bidderMadeIt;
      const yourTeam = gameState.teams.find(t => t.id === 'team1');
      const yourTeamWins = yourTeam && yourTeam.score >= gameState.targetScore;

      const soundDelay = isDramaticReveal ? 2000 : 300;

      const scoreTension = computeTension(gameState);
      if (isGameOverNow) {
        setTimeout(() => playSound(yourTeamWins ? 'victory' : 'defeat', scoreTension), soundDelay);
      } else {
        setTimeout(() => playSound(isGoodForYou ? 'bidMade' : 'bidSet', scoreTension), soundDelay);
      }
    }
    prevShowScoreModalRef.current = showScoreModal;
  }, [showScoreModal, gameState, playSound, isDramaticReveal]);

  const getTeamForPlayer = (player: typeof humanPlayer) => 
    gameState.teams.find(t => t.id === player.teamId)!;

  // Get floating emoji for a player
  const getFloatingEmojiForPlayer = (playerId: string, position: 'left' | 'right' | 'top' | 'bottom') => {
    const emoji = floatingEmojis.find(e => e.senderId === playerId);
    if (!emoji) return null;
    return <FloatingEmoji key={emoji.id} emoji={emoji} senderPosition={position} onComplete={removeFloatingEmoji} />;
  };

  const handleReturnToLobby = useCallback(() => {
    if (isSpectating) {
      multiplayer.leaveSpectate();
    } else {
      multiplayer.leaveRoom();
    }
    setGameState(initializeGame());
  }, [multiplayer, isSpectating]);

  return (
    <div
      className={cn(
        "flex flex-col bg-background game-table",
        gameState.phase === 'setup' || gameState.phase === 'dealer-draw'
          ? 'min-h-screen'
          : 'h-screen overflow-hidden',
        screenShake && 'screen-shake'
      )}
      style={gameState.phase !== 'setup' && gameState.phase !== 'dealer-draw' ? { height: '100dvh' } : undefined}
      data-testid="game-board"
    >
      <TensionProvider gameState={gameState}>
      {isMultiplayerMode && (
        <ConnectionStatus
          connected={multiplayer.connected}
          reconnecting={multiplayer.reconnecting}
          roomUnavailable={multiplayer.roomUnavailable}
          error={multiplayer.error}
          inRoom={!!multiplayer.roomCode}
          onReturnToLobby={handleReturnToLobby}
        />
      )}
      <GameHeader
        gameState={gameState}
        onSettingsClick={() => setSettingsOpen(true)}
        onShareClick={() => setShareOpen(true)}
        onRulesClick={() => setRulesOpen(true)}
        onLastTrickClick={() => setShowLastTrick(true)}
        onExitGame={handleExitGame}
        hideScores={hideHeaderScores}
      />
      {gameState.phase === 'setup' && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {showStats ? (
            <StatsPage onBack={() => setShowStats(false)} />
          ) : !showMultiplayerLobby ? (
            <HomeScreen
              onPlay={() => setShowMultiplayerLobby(true)}
              onRules={() => setRulesOpen(true)}
              onStats={() => setShowStats(true)}
            />
          ) : (
            <MultiplayerLobby
              connected={multiplayer.connected}
              roomCode={multiplayer.roomCode}
              seatIndex={multiplayer.seatIndex}
              players={multiplayer.players}
              error={multiplayer.error}
              onCreateRoom={multiplayer.createRoom}
              onJoinRoom={multiplayer.joinRoom}
              onPreviewRoom={multiplayer.previewRoom}
              onStartGame={multiplayer.startGame}
              onLeaveRoom={() => {
                multiplayer.leaveRoom();
                setShowMultiplayerLobby(false);
              }}
              onClose={() => setShowMultiplayerLobby(false)}
              onAddCpu={multiplayer.addCpu}
              onRemoveCpu={multiplayer.removeCpu}
              onKickPlayer={multiplayer.kickPlayer}
              onSwapSeats={multiplayer.swapSeats}
              onRandomizeTeams={multiplayer.randomizeTeams}
              deckColor={localGameState.deckColor}
              targetScore={localGameState.targetScore}
              spectatorCount={multiplayer.spectatorCount}
              activeGames={multiplayer.activeGames}
              onSpectateRoom={multiplayer.spectateRoom}
              onListActiveGames={multiplayer.listActiveGames}
            />
          )}
        </div>
      )}
      {gameState.phase !== 'setup' && gameState.phase !== 'dealer-draw' && (
        isMultiplayerMode && !isSpectating && multiplayer.seatIndex === null ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Connecting to game...</p>
          </div>
        ) : (
        <div className="flex-1 flex flex-col p-2 sm:p-4 md:p-6 gap-2 sm:gap-4 overflow-hidden">
          {isSpectating && (
            <div className="flex items-center justify-center gap-3 px-3 py-1.5 bg-[hsl(var(--gold)/0.08)] border border-[hsl(var(--gold)/0.2)] rounded-lg mx-auto">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-[hsl(var(--gold))]" />
                <span className="text-xs text-[hsl(var(--gold))] font-medium" style={{ fontFamily: 'var(--font-display)' }}>
                  Watching{multiplayer.spectatorCount > 0 ? ` \u2014 ${multiplayer.spectatorCount} spectator${multiplayer.spectatorCount !== 1 ? 's' : ''}` : ''}
                </span>
              </div>
              <button
                onClick={() => {
                  multiplayer.leaveSpectate();
                  setShowMultiplayerLobby(true);
                }}
                className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Leave
              </button>
            </div>
          )}
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
                onShake={handleCatch5Shake}
                trickNumber={gameState.trickNumber}
              />
              
              {/* Timer and context line */}
              <div className="mt-1 flex flex-col items-center gap-1">
                {(gameState.phase === 'bidding' || gameState.phase === 'playing') && gameState.turnStartTime && (
                  <TurnTimer
                    key={gameState.turnStartTime}
                    isActive={true}
                    duration={20}
                    onTimeout={isMyTurn ? handleTurnTimeout : undefined}
                    playerName={currentPlayer?.name}
                    isCurrentPlayer={isMyTurn}
                    serverStartTime={gameState.turnStartTime}
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

          {/* Bottom player area with bidding panel overlaying cards */}
          <div className="relative flex flex-col items-center gap-2">
            {showBiddingModal && (
              <div className="absolute bottom-full mb-2 z-30 w-full flex justify-center">
                <BiddingPanel
                  open={showBiddingModal}
                  highBid={gameState.highBid}
                  playerName={humanPlayer.name}
                  isDealer={isDealer}
                  allOthersPassed={passedCount === 3}
                  onBid={handleBid}
                />
              </div>
            )}
            {!isSpectating && gameState.phase === 'discard-trump' && isMyTurn && (
              <div className="text-center mb-2 p-2 bg-destructive/10 border border-destructive/30 rounded-md">
                <p className="text-sm font-medium text-destructive">
                  You have {humanPlayer.hand.length} trump cards. Tap a card to discard down to 6.
                </p>
              </div>
            )}
            <PlayerArea
              player={humanPlayer}
              team={getTeamForPlayer(humanPlayer)}
              isCurrentPlayer={gameState.currentPlayerIndex === mySeatIndex}
              isBidder={gameState.bidderId === humanPlayer.id}
              isDealer={gameState.dealerIndex === mySeatIndex}
              deckColor={gameState.deckColor}
              onCardClick={
                !isSpectating && isMyTurn && gameState.phase === 'playing'
                  ? handleCardPlay
                  : !isSpectating && isMyTurn && gameState.phase === 'discard-trump'
                  ? handleDiscardTrump
                  : undefined
              }
              canPlayCard={(card) =>
                !isSpectating && isMyTurn && gameState.phase === 'playing'
                  ? canPlayCard(card, humanPlayer.hand, gameState.currentTrick, gameState.trumpSuit)
                  : !isSpectating && isMyTurn && gameState.phase === 'discard-trump'
                  ? true
                  : false
              }
              position="bottom"
              showCards={!isSpectating}
              showBidResult={showBidResults}
              trumpSuit={gameState.trumpSuit}
              onSortHand={!isSpectating ? handleSortHand : undefined}
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
        open={!isSpectating && showPurgeDraw}
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
        onContinue={isSpectating ? () => {} : handleContinue}
        isGameOver={checkGameOver(gameState)}
        targetScore={gameState.targetScore}
        sleptCards={gameState.sleptCards}
        trumpSuit={gameState.trumpSuit}
        localTeamId={gameState.players[mySeatIndex]?.teamId || 'team1'}
        isDramaticReveal={isDramaticReveal}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        deckColor={gameState.deckColor}
        onDeckColorChange={(color) => setGameState(prev => ({ ...prev, deckColor: color }))}
        onNewGame={handleNewGame}
        onExitGame={handleExitGame}
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
        open={!isSpectating && (isMultiplayerMode ? gameState.phase === 'dealer-draw' : showDealerDraw)}
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
      {(isMultiplayerMode || isSpectating) && gameState.phase !== 'setup' && (gameState.players[mySeatIndex] || isSpectating) && (
        <ChatPanel
          messages={multiplayer.chatMessages}
          onSendMessage={handleSendChat}
          currentPlayerId={isSpectating ? `spectator_${multiplayer.spectatorId}` : gameState.players[mySeatIndex].id}
          isOpen={isChatOpen}
          onToggle={handleChatToggle}
          unreadCount={unreadCount}
        />
      )}
      </TensionProvider>
    </div>
  );
}
