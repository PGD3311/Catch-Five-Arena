import {
  Card,
  Player,
  GameState,
  Suit,
  DeckColor,
  createDeck,
  shuffleDeck,
  determineTrickWinner,
  calculateRoundScores,
  RANK_ORDER,
} from '@shared/gameTypes';

export function initializeGame(deckColor: DeckColor = 'blue'): GameState {
  const players: Player[] = [
    { id: 'player1', name: 'You', isHuman: true, hand: [], score: 0, bid: null, tricksWon: [] },
    { id: 'player2', name: 'CPU 1', isHuman: false, hand: [], score: 0, bid: null, tricksWon: [] },
    { id: 'player3', name: 'CPU 2', isHuman: false, hand: [], score: 0, bid: null, tricksWon: [] },
    { id: 'player4', name: 'CPU 3', isHuman: false, hand: [], score: 0, bid: null, tricksWon: [] },
  ];

  return {
    phase: 'setup',
    players,
    currentPlayerIndex: 0,
    trumpSuit: null,
    highBid: 0,
    bidderId: null,
    currentTrick: [],
    trickNumber: 1,
    leadPlayerIndex: 0,
    roundScores: {},
    deckColor,
  };
}

export function dealCards(state: GameState): GameState {
  const deck = shuffleDeck(createDeck());
  const newPlayers = state.players.map((player, index) => ({
    ...player,
    hand: deck.slice(index * 6, (index + 1) * 6),
    bid: null,
    tricksWon: [],
  }));

  return {
    ...state,
    phase: 'bidding',
    players: newPlayers,
    currentPlayerIndex: 0,
    trumpSuit: null,
    highBid: 0,
    bidderId: null,
    currentTrick: [],
    trickNumber: 1,
    roundScores: {},
  };
}

export function getCpuBid(hand: Card[], highBid: number): number {
  let trumpPotential = 0;
  const suitCounts: Record<Suit, number> = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };
  const highCards: Record<Suit, number> = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };

  for (const card of hand) {
    suitCounts[card.suit]++;
    if (RANK_ORDER[card.rank] >= 9) {
      highCards[card.suit]++;
    }
    if (card.rank === '5') {
      trumpPotential += 2;
    }
    if (card.rank === 'A' || card.rank === 'K') {
      trumpPotential += 1;
    }
  }

  const bestSuit = Object.entries(suitCounts).reduce((a, b) => (b[1] > a[1] ? b : a))[0] as Suit;
  const potentialBid = Math.min(9, Math.max(2, suitCounts[bestSuit] + highCards[bestSuit] + Math.floor(trumpPotential / 2)));

  if (potentialBid > highBid && Math.random() > 0.3) {
    return potentialBid;
  }
  return 0;
}

export function getCpuTrumpChoice(hand: Card[]): Suit {
  const suitScores: Record<Suit, number> = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };

  for (const card of hand) {
    suitScores[card.suit] += 1;
    if (card.rank === '5') suitScores[card.suit] += 5;
    if (card.rank === 'J') suitScores[card.suit] += 2;
    if (card.rank === 'A') suitScores[card.suit] += 3;
    if (card.rank === 'K') suitScores[card.suit] += 2;
    if (card.rank === 'Q') suitScores[card.suit] += 1;
  }

  return Object.entries(suitScores).reduce((a, b) => (b[1] > a[1] ? b : a))[0] as Suit;
}

export function getCpuCardToPlay(
  hand: Card[],
  currentTrick: { playerId: string; card: Card }[],
  trumpSuit: Suit | null
): Card {
  if (currentTrick.length === 0) {
    const trumpCards = hand.filter(c => c.suit === trumpSuit);
    if (trumpCards.length > 0 && Math.random() > 0.5) {
      return trumpCards.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
    }
    return hand[Math.floor(Math.random() * hand.length)];
  }

  const leadSuit = currentTrick[0].card.suit;
  const followCards = hand.filter(c => c.suit === leadSuit);

  if (followCards.length > 0) {
    return followCards.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
  }

  const trumpCards = hand.filter(c => c.suit === trumpSuit);
  if (trumpCards.length > 0) {
    return trumpCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
  }

  return hand.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
}

export function processBid(state: GameState, bid: number): GameState {
  const newPlayers = [...state.players];
  newPlayers[state.currentPlayerIndex] = {
    ...newPlayers[state.currentPlayerIndex],
    bid,
  };

  let newHighBid = state.highBid;
  let newBidderId = state.bidderId;

  if (bid > state.highBid) {
    newHighBid = bid;
    newBidderId = newPlayers[state.currentPlayerIndex].id;
  }

  const nextPlayerIndex = (state.currentPlayerIndex + 1) % 4;
  const allBid = newPlayers.every(p => p.bid !== null);

  if (allBid) {
    if (newHighBid === 0) {
      return dealCards({ ...state, players: newPlayers });
    }

    const bidderIndex = newPlayers.findIndex(p => p.id === newBidderId);
    const bidder = newPlayers[bidderIndex];

    if (!bidder.isHuman) {
      const trumpChoice = getCpuTrumpChoice(bidder.hand);
      return {
        ...state,
        players: newPlayers,
        highBid: newHighBid,
        bidderId: newBidderId,
        phase: 'playing',
        trumpSuit: trumpChoice,
        currentPlayerIndex: bidderIndex,
        leadPlayerIndex: bidderIndex,
      };
    }

    return {
      ...state,
      players: newPlayers,
      highBid: newHighBid,
      bidderId: newBidderId,
      phase: 'trump-selection',
      currentPlayerIndex: bidderIndex,
    };
  }

  return {
    ...state,
    players: newPlayers,
    highBid: newHighBid,
    bidderId: newBidderId,
    currentPlayerIndex: nextPlayerIndex,
  };
}

export function selectTrump(state: GameState, suit: Suit): GameState {
  const bidderIndex = state.players.findIndex(p => p.id === state.bidderId);
  return {
    ...state,
    phase: 'playing',
    trumpSuit: suit,
    currentPlayerIndex: bidderIndex,
    leadPlayerIndex: bidderIndex,
  };
}

export function playCard(state: GameState, card: Card): GameState {
  const player = state.players[state.currentPlayerIndex];
  const newHand = player.hand.filter(c => c.id !== card.id);
  const newPlayers = [...state.players];
  newPlayers[state.currentPlayerIndex] = { ...player, hand: newHand };

  const newTrick = [...state.currentTrick, { playerId: player.id, card }];

  if (newTrick.length === 4) {
    const winnerId = determineTrickWinner(newTrick, state.trumpSuit);
    const winnerIndex = newPlayers.findIndex(p => p.id === winnerId);
    const trickCards = newTrick.map(t => t.card);

    newPlayers[winnerIndex] = {
      ...newPlayers[winnerIndex],
      tricksWon: [...newPlayers[winnerIndex].tricksWon, ...trickCards],
    };

    const newTrickNumber = state.trickNumber + 1;

    if (newTrickNumber > 6) {
      const roundScores = calculateRoundScores(newPlayers, state.trumpSuit!);

      for (let i = 0; i < newPlayers.length; i++) {
        const scoreData = roundScores[newPlayers[i].id];
        let pointsToAdd = scoreData.points;

        if (newPlayers[i].id === state.bidderId && pointsToAdd < state.highBid) {
          pointsToAdd = -state.highBid;
        }

        newPlayers[i] = {
          ...newPlayers[i],
          score: newPlayers[i].score + pointsToAdd,
        };
      }

      return {
        ...state,
        players: newPlayers,
        currentTrick: [],
        trickNumber: newTrickNumber,
        phase: 'scoring',
        roundScores: Object.fromEntries(
          Object.entries(roundScores).map(([id, data]) => [id, data.points])
        ),
      };
    }

    return {
      ...state,
      players: newPlayers,
      currentTrick: [],
      trickNumber: newTrickNumber,
      currentPlayerIndex: winnerIndex,
      leadPlayerIndex: winnerIndex,
    };
  }

  return {
    ...state,
    players: newPlayers,
    currentTrick: newTrick,
    currentPlayerIndex: (state.currentPlayerIndex + 1) % 4,
  };
}

export function canPlayCard(card: Card, hand: Card[], currentTrick: { playerId: string; card: Card }[]): boolean {
  if (currentTrick.length === 0) return true;

  const leadSuit = currentTrick[0].card.suit;
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);

  if (hasLeadSuit) {
    return card.suit === leadSuit;
  }

  return true;
}

export function startNewRound(state: GameState): GameState {
  return dealCards(state);
}

export function checkGameOver(state: GameState, targetScore: number = 21): boolean {
  return state.players.some(p => p.score >= targetScore);
}

export function getWinner(state: GameState): Player | null {
  const maxScore = Math.max(...state.players.map(p => p.score));
  const winners = state.players.filter(p => p.score === maxScore);
  return winners.length === 1 ? winners[0] : null;
}
