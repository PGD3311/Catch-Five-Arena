import { GameState, Card as CardType, Suit } from '@shared/gameTypes';
import { PlayerArea } from './PlayerArea';
import { TrickArea } from './TrickArea';
import { GameHeader } from './GameHeader';
import { BiddingModal } from './BiddingModal';
import { TrumpSelector } from './TrumpSelector';
import { ScoreModal } from './ScoreModal';
import { SettingsPanel } from './SettingsPanel';
import { RulesModal } from './RulesModal';
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
} from '@/lib/gameEngine';

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState>(() => initializeGame());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const handleStartGame = useCallback(() => {
    setGameState(prev => dealCards(prev));
  }, []);

  const handleBid = useCallback((bid: number) => {
    setGameState(prev => processBid(prev, bid));
  }, []);

  const handleTrumpSelect = useCallback((suit: Suit) => {
    setGameState(prev => selectTrump(prev, suit));
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
        return initializeGame(prev.deckColor);
      }
      return startNewRound(prev);
    });
  }, []);

  const handleNewGame = useCallback(() => {
    setGameState(prev => initializeGame(prev.deckColor));
    setSettingsOpen(false);
  }, []);

  useEffect(() => {
    if (gameState.phase === 'bidding') {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!currentPlayer.isHuman) {
        const timer = setTimeout(() => {
          const cpuBid = getCpuBid(currentPlayer.hand, gameState.highBid);
          setGameState(prev => processBid(prev, cpuBid));
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.players, gameState.highBid]);

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
  const cpuPlayers = gameState.players.slice(1);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isHumanTurn = currentPlayer?.isHuman;
  const showBiddingModal = gameState.phase === 'bidding' && isHumanTurn;
  const showTrumpSelector = gameState.phase === 'trump-selection';
  const showScoreModal = gameState.phase === 'scoring' || gameState.phase === 'game-over';

  return (
    <div className="flex flex-col min-h-screen bg-background" data-testid="game-board">
      <GameHeader gameState={gameState} onSettingsClick={() => setSettingsOpen(true)} />

      {gameState.phase === 'setup' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-bold tracking-tight">Catch 5</h1>
            <p className="text-lg text-muted-foreground max-w-md">
              A classic trick-taking card game. Be the first to reach 21 points!
            </p>
          </div>
          <div className="flex gap-4">
            <Button size="lg" onClick={handleStartGame} data-testid="button-start-game">
              Start Game
            </Button>
            <Button size="lg" variant="outline" onClick={() => setRulesOpen(true)} data-testid="button-how-to-play">
              How to Play
            </Button>
          </div>
        </div>
      )}

      {gameState.phase !== 'setup' && (
        <div className="flex-1 flex flex-col p-4 md:p-6 gap-4">
          <div className="flex justify-center gap-6 md:gap-12">
            {cpuPlayers.map((player, index) => (
              <PlayerArea
                key={player.id}
                player={player}
                isCurrentPlayer={gameState.currentPlayerIndex === index + 1}
                isBidder={gameState.bidderId === player.id}
                deckColor={gameState.deckColor}
                position="top"
              />
            ))}
          </div>

          <div className="flex-1 flex items-center justify-center">
            <TrickArea currentTrick={gameState.currentTrick} players={gameState.players} />
          </div>

          <div className="flex justify-center">
            <PlayerArea
              player={humanPlayer}
              isCurrentPlayer={gameState.currentPlayerIndex === 0}
              isBidder={gameState.bidderId === humanPlayer.id}
              deckColor={gameState.deckColor}
              onCardClick={handleCardPlay}
              canPlayCard={(card) => canPlayCard(card, humanPlayer.hand, gameState.currentTrick)}
              position="bottom"
              showCards
            />
          </div>
        </div>
      )}

      <BiddingModal
        open={showBiddingModal}
        highBid={gameState.highBid}
        playerName={humanPlayer.name}
        onBid={handleBid}
      />

      <TrumpSelector
        open={showTrumpSelector}
        onSelect={handleTrumpSelect}
      />

      <ScoreModal
        open={showScoreModal}
        players={gameState.players}
        roundScores={gameState.roundScores}
        bidderId={gameState.bidderId}
        highBid={gameState.highBid}
        onContinue={handleContinue}
        isGameOver={checkGameOver(gameState)}
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
      />

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
