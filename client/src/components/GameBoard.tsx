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
import { MultiplayerLobby } from './MultiplayerLobby';
import { LastTrickModal } from './LastTrickModal';
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
} from '@/lib/gameEngine';

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
  const trickWinnerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const multiplayer = useMultiplayer();
  const isMultiplayerMode = !!multiplayer.roomCode;
  const gameState = isMultiplayerMode && multiplayer.gameState ? multiplayer.gameState : localGameState;
  const mySeatIndex = isMultiplayerMode ? (multiplayer.seatIndex ?? 0) : 0;

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
    if (!isMultiplayerMode) {
      setShowPurgeDraw(false);
      setGameState(prev => performPurgeAndDraw(prev));
    }
  }, [isMultiplayerMode]);

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
  }, [mySeatIndex]);

  useEffect(() => {
    return () => {
      if (trickWinnerTimeoutRef.current) {
        clearTimeout(trickWinnerTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isMultiplayerMode) return;
    if (gameState.phase === 'bidding') {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!currentPlayer.isHuman) {
        const baseDelay = 800 + Math.random() * 600;
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
        const timer = setTimeout(() => {
          // Check if dealer was forced to bid (all others passed, bid is minimum)
          const wasForcedBid = gameState.highBid === 5 && 
            gameState.players.filter(p => p.bid === 0).length === 3;
          const bestSuit = getCpuTrumpChoice(bidder.hand, wasForcedBid);
          handleTrumpSelect(bestSuit);
        }, 900 + Math.random() * 400);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.phase, gameState.players, gameState.bidderId, gameState.highBid, isMultiplayerMode, handleTrumpSelect]);

  useEffect(() => {
    if (isMultiplayerMode) return;
    if (gameState.phase === 'playing') {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!currentPlayer.isHuman && currentPlayer.hand.length > 0) {
        const baseDelay = displayTrick.length > 0 ? 2800 : 700 + Math.random() * 500;
        const timer = setTimeout(() => {
          const cardToPlay = getCpuCardToPlay(
            currentPlayer.hand,
            gameState.currentTrick,
            gameState.trumpSuit,
            currentPlayer.id,
            gameState.players,
            gameState.bidderId
          );
          
          const newTrick = [...gameState.currentTrick, { playerId: currentPlayer.id, card: cardToPlay }];
          
          if (newTrick.length === 4 && gameState.trumpSuit) {
            setDisplayTrick(newTrick);
            
            if (trickWinnerTimeoutRef.current) {
              clearTimeout(trickWinnerTimeoutRef.current);
            }
            trickWinnerTimeoutRef.current = setTimeout(() => {
              setDisplayTrick([]);
              setGameState(prev => playCard(prev, cardToPlay));
            }, 2500);
          } else {
            setGameState(prev => playCard(prev, cardToPlay));
          }
        }, baseDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.players, gameState.currentTrick, gameState.trumpSuit, isMultiplayerMode, displayTrick.length]);

  useEffect(() => {
    if (isMultiplayerMode) return;
    if (gameState.phase !== 'playing') return;
    if (gameState.currentTrick.length !== 0) return;
    if (gameState.trickNumber <= 1) return;
    if (displayTrick.length > 0) return;
    
    const claim = checkAutoClaim(gameState.players, gameState.trumpSuit, gameState.stock);
    if (claim && claim.remainingTricks > 0) {
      const claimer = gameState.players.find(p => p.id === claim.claimerId);
      if (claimer) {
        toast({
          title: "Auto-Claim",
          description: `${claimer.name} claims remaining tricks with all remaining trumps!`,
        });
        
        setTimeout(() => {
          setGameState(prev => applyAutoClaim(prev, claim.claimerId));
        }, 1000);
      }
    }
  }, [gameState.phase, gameState.currentTrick.length, gameState.trickNumber, gameState.players, gameState.trumpSuit, gameState.stock, isMultiplayerMode, displayTrick.length, toast]);

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
  
  const showBiddingModal = gameState.phase === 'bidding' && isMyTurn;
  const amIBidder = gameState.bidderId === gameState.players[mySeatIndex]?.id;
  const showTrumpSelector = gameState.phase === 'trump-selection' && 
    (isMultiplayerMode ? amIBidder : gameState.players.find(p => p.id === gameState.bidderId)?.isHuman);
  const showScoreModal = gameState.phase === 'scoring' || gameState.phase === 'game-over';
  const showBidResults = gameState.phase === 'bidding' || gameState.phase === 'trump-selection' || gameState.phase === 'purge-draw';

  const getTeamForPlayer = (player: typeof humanPlayer) => 
    gameState.teams.find(t => t.id === player.teamId)!;

  return (
    <div className="flex flex-col min-h-screen bg-background game-table" data-testid="game-board">
      <GameHeader 
        gameState={gameState} 
        onSettingsClick={() => setSettingsOpen(true)}
        onShareClick={() => setShareOpen(true)}
        onRulesClick={() => setRulesOpen(true)}
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
            <div className="max-w-sm mx-auto space-y-3">
              <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <span>2v2 Teams</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                <span>Bid 5-9</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                <span>Trump Suits</span>
              </div>
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
          <div className="flex justify-center">
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

          <div className="flex-1 flex items-center justify-between gap-1 sm:gap-4">
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

            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <TrickArea 
                currentTrick={displayTrick.length > 0 ? displayTrick : gameState.currentTrick} 
                players={gameState.players} 
                trumpSuit={gameState.trumpSuit} 
              />
              
              <div className="flex items-center gap-3">
                {(gameState.phase === 'bidding' || gameState.phase === 'trump-selection' || gameState.phase === 'playing') && (
                  <ActionPrompt gameState={gameState} />
                )}
                
                {gameState.lastTrick && gameState.lastTrick.length > 0 && gameState.phase === 'playing' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLastTrick(true)}
                    className="gap-1.5"
                    data-testid="button-last-trick"
                  >
                    <History className="w-4 h-4" />
                    Last Trick
                  </Button>
                )}
              </div>
            </div>

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

          <div className="flex flex-col items-center gap-2 sm:gap-3">
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
        open={isMultiplayerMode ? false : showPurgeDraw}
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
    </div>
  );
}
