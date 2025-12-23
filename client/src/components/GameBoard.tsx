import { GameState, Card as CardType, Suit } from '@shared/gameTypes';
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
import { Button } from '@/components/ui/button';
import { useState, useEffect, useCallback } from 'react';
import {
  initializeGame,
  dealCards,
  processBid,
  selectTrump,
  playCard,
  canPlayCard,
  getCpuBid,
  getCpuCardToPlay,
  startNewRound,
  checkGameOver,
  performPurgeAndDraw,
  startDealerDraw,
  finalizeDealerDraw,
} from '@/lib/gameEngine';

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState>(() => initializeGame());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showPurgeDraw, setShowPurgeDraw] = useState(false);
  const [showDealerDraw, setShowDealerDraw] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });

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

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const handleStartGame = useCallback(() => {
    setGameState(prev => startDealerDraw(prev));
    setShowDealerDraw(true);
  }, []);

  const handleDealerDrawComplete = useCallback(() => {
    setShowDealerDraw(false);
    setGameState(prev => {
      const withDealer = finalizeDealerDraw(prev);
      return dealCards(withDealer);
    });
  }, []);

  const handleBid = useCallback((bid: number) => {
    setGameState(prev => processBid(prev, bid));
  }, []);

  const handleTrumpSelect = useCallback((suit: Suit) => {
    setGameState(prev => ({
      ...prev,
      trumpSuit: suit,
      phase: 'purge-draw' as const,
    }));
    setShowPurgeDraw(true);
  }, []);

  const handlePurgeDrawComplete = useCallback(() => {
    setShowPurgeDraw(false);
    setGameState(prev => performPurgeAndDraw(prev));
  }, []);

  const handleCardPlay = useCallback((card: CardType) => {
    setGameState(prev => {
      const currentPlayer = prev.players[prev.currentPlayerIndex];
      if (!canPlayCard(card, currentPlayer.hand, prev.currentTrick)) {
        return prev;
      }
      return playCard(prev, card);
    });
  }, []);

  const handleContinue = useCallback(() => {
    setGameState(prev => {
      if (checkGameOver(prev)) {
        return initializeGame(prev.deckColor, prev.targetScore);
      }
      return startNewRound(prev);
    });
  }, []);

  const handleNewGame = useCallback(() => {
    setGameState(prev => initializeGame(prev.deckColor, prev.targetScore));
    setSettingsOpen(false);
  }, []);

  useEffect(() => {
    if (gameState.phase === 'bidding') {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!currentPlayer.isHuman) {
        const timer = setTimeout(() => {
          const passedCount = gameState.players.filter(p => p.bid === 0).length;
          const isDealer = gameState.currentPlayerIndex === gameState.dealerIndex;
          const isLastAndAllPassed = isDealer && passedCount === 3;
          const cpuBid = getCpuBid(currentPlayer.hand, gameState.highBid, isDealer, isLastAndAllPassed);
          setGameState(prev => processBid(prev, cpuBid));
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.players, gameState.highBid, gameState.dealerIndex]);

  useEffect(() => {
    if (gameState.phase === 'trump-selection') {
      const bidder = gameState.players.find(p => p.id === gameState.bidderId);
      if (bidder && !bidder.isHuman) {
        const timer = setTimeout(() => {
          const suitScores: Record<Suit, number> = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };
          for (const card of bidder.hand) {
            suitScores[card.suit] += 1;
            if (card.rank === '5') suitScores[card.suit] += 6;
            if (card.rank === 'J') suitScores[card.suit] += 2;
            if (card.rank === 'A') suitScores[card.suit] += 4;
          }
          const bestSuit = Object.entries(suitScores).reduce((a, b) => (b[1] > a[1] ? b : a))[0] as Suit;
          handleTrumpSelect(bestSuit);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.phase, gameState.players, gameState.bidderId]);

  useEffect(() => {
    if (gameState.phase === 'playing') {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!currentPlayer.isHuman && currentPlayer.hand.length > 0) {
        const timer = setTimeout(() => {
          const cardToPlay = getCpuCardToPlay(
            currentPlayer.hand,
            gameState.currentTrick,
            gameState.trumpSuit
          );
          setGameState(prev => playCard(prev, cardToPlay));
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.players, gameState.currentTrick, gameState.trumpSuit]);

  const humanPlayer = gameState.players[0];
  const partnerPlayer = gameState.players[2];
  const opponent1 = gameState.players[1];
  const opponent2 = gameState.players[3];
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isHumanTurn = currentPlayer?.isHuman;
  
  const passedCount = gameState.players.filter(p => p.bid === 0).length;
  const isDealer = gameState.currentPlayerIndex === gameState.dealerIndex;
  
  const showBiddingModal = gameState.phase === 'bidding' && isHumanTurn;
  const showTrumpSelector = gameState.phase === 'trump-selection' && 
    gameState.players.find(p => p.id === gameState.bidderId)?.isHuman;
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
              <p className="text-sm uppercase tracking-widest text-muted-foreground">
                Classic Trick-Taking Card Game
              </p>
            </div>
            <div className="max-w-sm mx-auto space-y-3">
              <p className="text-lg text-foreground/80">
                Team up with your partner to capture tricks and reach {gameState.targetScore} points first!
              </p>
              <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <span>2v2 Teams</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                <span>Bid 5-9</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                <span>Trump Suits</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" onClick={handleStartGame} className="px-8" data-testid="button-start-game">
              Deal Cards
            </Button>
            <Button size="lg" variant="outline" onClick={() => setRulesOpen(true)} data-testid="button-how-to-play">
              How to Play
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Open Settings to configure players and deck colors
          </p>
        </div>
      )}

      {gameState.phase !== 'setup' && gameState.phase !== 'dealer-draw' && (
        <div className="flex-1 flex flex-col p-4 md:p-6 gap-4">
          <div className="flex justify-center">
            <PlayerArea
              player={partnerPlayer}
              team={getTeamForPlayer(partnerPlayer)}
              isCurrentPlayer={gameState.currentPlayerIndex === 2}
              isBidder={gameState.bidderId === partnerPlayer.id}
              isDealer={gameState.dealerIndex === 2}
              deckColor={gameState.deckColor}
              position="top"
              showBidResult={showBidResults}
            />
          </div>

          <div className="flex-1 flex items-center justify-between gap-4">
            <PlayerArea
              player={opponent1}
              team={getTeamForPlayer(opponent1)}
              isCurrentPlayer={gameState.currentPlayerIndex === 1}
              isBidder={gameState.bidderId === opponent1.id}
              isDealer={gameState.dealerIndex === 1}
              deckColor={gameState.deckColor}
              position="left"
              showBidResult={showBidResults}
            />

            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <TrickArea currentTrick={gameState.currentTrick} players={gameState.players} />
              
              {(gameState.phase === 'bidding' || gameState.phase === 'trump-selection' || gameState.phase === 'playing') && (
                <ActionPrompt gameState={gameState} />
              )}
            </div>

            <PlayerArea
              player={opponent2}
              team={getTeamForPlayer(opponent2)}
              isCurrentPlayer={gameState.currentPlayerIndex === 3}
              isBidder={gameState.bidderId === opponent2.id}
              isDealer={gameState.dealerIndex === 3}
              deckColor={gameState.deckColor}
              position="right"
              showBidResult={showBidResults}
            />
          </div>

          <div className={cn("flex justify-center transition-all duration-300", showBiddingModal && "pb-24")}>
            <PlayerArea
              player={humanPlayer}
              team={getTeamForPlayer(humanPlayer)}
              isCurrentPlayer={gameState.currentPlayerIndex === 0}
              isBidder={gameState.bidderId === humanPlayer.id}
              isDealer={gameState.dealerIndex === 0}
              deckColor={gameState.deckColor}
              onCardClick={handleCardPlay}
              canPlayCard={(card) => canPlayCard(card, humanPlayer.hand, gameState.currentTrick)}
              position="bottom"
              showCards
              showBidResult={showBidResults}
            />
          </div>
        </div>
      )}

      <BiddingPanel
        open={showBiddingModal}
        highBid={gameState.highBid}
        playerName={humanPlayer.name}
        isDealer={isDealer}
        allOthersPassed={passedCount === 3}
        onBid={handleBid}
      />

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
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        playerConfigs={gameState.players.map(p => ({ id: p.id, name: p.name, isHuman: p.isHuman }))}
        onTogglePlayerType={handleTogglePlayerType}
        onPlayerNameChange={handlePlayerNameChange}
      />

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <DealerDrawModal
        open={showDealerDraw}
        players={gameState.players}
        dealerDrawCards={gameState.dealerDrawCards || []}
        onComplete={handleDealerDrawComplete}
        deckColor={gameState.deckColor}
      />
    </div>
  );
}
