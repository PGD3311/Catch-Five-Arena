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
          const allOthersPassed = gameState.players
            .filter((_, i) => i !== gameState.currentPlayerIndex)
            .every(p => p.bid === 0);
          const isDealer = gameState.currentPlayerIndex === gameState.dealerIndex;
          const cpuBid = getCpuBid(currentPlayer.hand, gameState.highBid, isDealer, allOthersPassed);
          setGameState(prev => processBid(prev, cpuBid));
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.players, gameState.highBid, gameState.dealerIndex]);

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
  
  const allOthersPassed = gameState.players
    .filter((_, i) => i !== gameState.currentPlayerIndex)
    .filter(p => p.bid !== null)
    .every(p => p.bid === 0);
  const isDealer = gameState.currentPlayerIndex === gameState.dealerIndex;
  
  const showBiddingModal = gameState.phase === 'bidding' && isHumanTurn;
  const showTrumpSelector = gameState.phase === 'trump-selection';
  const showScoreModal = gameState.phase === 'scoring' || gameState.phase === 'game-over';

  const getTeamForPlayer = (player: typeof humanPlayer) => 
    gameState.teams.find(t => t.id === player.teamId)!;

  return (
    <div className="flex flex-col min-h-screen bg-background" data-testid="game-board">
      <GameHeader gameState={gameState} onSettingsClick={() => setSettingsOpen(true)} />

      {gameState.phase === 'setup' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-bold tracking-tight">Catch 5</h1>
            <p className="text-lg text-muted-foreground max-w-md">
              A 2v2 trick-taking card game. First team to {gameState.targetScore} points wins!
            </p>
            <p className="text-sm text-muted-foreground">
              You and your Partner vs. the Opponents
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
          <div className="flex justify-center">
            <PlayerArea
              player={partnerPlayer}
              team={getTeamForPlayer(partnerPlayer)}
              isCurrentPlayer={gameState.currentPlayerIndex === 2}
              isBidder={gameState.bidderId === partnerPlayer.id}
              deckColor={gameState.deckColor}
              position="top"
            />
          </div>

          <div className="flex-1 flex items-center justify-between gap-4">
            <PlayerArea
              player={opponent1}
              team={getTeamForPlayer(opponent1)}
              isCurrentPlayer={gameState.currentPlayerIndex === 1}
              isBidder={gameState.bidderId === opponent1.id}
              deckColor={gameState.deckColor}
              position="left"
            />

            <div className="flex-1 flex items-center justify-center">
              <TrickArea currentTrick={gameState.currentTrick} players={gameState.players} />
            </div>

            <PlayerArea
              player={opponent2}
              team={getTeamForPlayer(opponent2)}
              isCurrentPlayer={gameState.currentPlayerIndex === 3}
              isBidder={gameState.bidderId === opponent2.id}
              deckColor={gameState.deckColor}
              position="right"
            />
          </div>

          <div className="flex justify-center">
            <PlayerArea
              player={humanPlayer}
              team={getTeamForPlayer(humanPlayer)}
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
        isDealer={isDealer}
        allOthersPassed={allOthersPassed && gameState.players.filter(p => p.bid !== null).length === 3}
        onBid={handleBid}
      />

      <TrumpSelector
        open={showTrumpSelector}
        onSelect={handleTrumpSelect}
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
      />

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
