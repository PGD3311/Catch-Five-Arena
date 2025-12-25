import {
  Card,
  Player,
  Team,
  GameState,
  Suit,
  DeckColor,
  DealerDrawCard,
  createDeck,
  shuffleDeck,
  determineTrickWinner,
  calculateRoundScores,
  RANK_ORDER,
  RANK_ORDER_ACE_LOW,
  MIN_BID,
  MAX_BID,
  INITIAL_HAND_SIZE,
  FINAL_HAND_SIZE,
  TOTAL_TRICKS,
  DEFAULT_TARGET_SCORE,
} from './gameTypes';

export { determineTrickWinner };

export function checkAutoClaim(players: Player[], trumpSuit: Suit | null, stock: Card[] = []): { claimerId: string; remainingTricks: number } | null {
  if (!trumpSuit) return null;
  
  // Don't auto-claim if there are still cards in the stock (trumps could be hidden there)
  if (stock.length > 0) return null;
  
  const playerTrumpCounts: Record<string, number> = {};
  let totalTrumps = 0;
  
  for (const player of players) {
    const trumpCount = player.hand.filter(c => c.suit === trumpSuit).length;
    playerTrumpCounts[player.id] = trumpCount;
    totalTrumps += trumpCount;
  }
  
  // No trumps left in anyone's hands
  if (totalTrumps === 0) return null;
  
  // Check if any single player holds ALL remaining trumps
  for (const player of players) {
    if (playerTrumpCounts[player.id] === totalTrumps && totalTrumps > 0) {
      const remainingTricks = player.hand.length;
      if (remainingTricks > 0) {
        return { claimerId: player.id, remainingTricks };
      }
    }
  }
  
  return null;
}

export function initializeGame(deckColor: DeckColor = 'blue', targetScore: number = DEFAULT_TARGET_SCORE): GameState {
  const players: Player[] = [
    { id: 'player1', name: 'You', isHuman: true, hand: [], teamId: 'team1', bid: null, tricksWon: [] },
    { id: 'player2', name: 'CPU 1', isHuman: false, hand: [], teamId: 'team2', bid: null, tricksWon: [] },
    { id: 'player3', name: 'Partner', isHuman: false, hand: [], teamId: 'team1', bid: null, tricksWon: [] },
    { id: 'player4', name: 'CPU 2', isHuman: false, hand: [], teamId: 'team2', bid: null, tricksWon: [] },
  ];

  const teams: Team[] = [
    { id: 'team1', name: 'Your Team', score: 0, playerIds: ['player1', 'player3'] },
    { id: 'team2', name: 'Opponents', score: 0, playerIds: ['player2', 'player4'] },
  ];

  return {
    phase: 'setup',
    players,
    teams,
    currentPlayerIndex: 0,
    dealerIndex: 0,
    trumpSuit: null,
    highBid: 0,
    bidderId: null,
    currentTrick: [],
    trickNumber: 1,
    leadPlayerIndex: 0,
    roundScores: {},
    deckColor,
    stock: [],
    discardPile: [],
    targetScore,
    dealerDrawCards: [],
  };
}

export function startDealerDraw(state: GameState): GameState {
  const deck = shuffleDeck(createDeck());
  const dealerDrawCards: DealerDrawCard[] = state.players.map((player, index) => ({
    playerId: player.id,
    card: deck[index],
  }));

  return {
    ...state,
    phase: 'dealer-draw',
    dealerDrawCards,
  };
}

const SUIT_ORDER: Record<string, number> = {
  'Clubs': 0,
  'Diamonds': 1,
  'Hearts': 2,
  'Spades': 3,
};

export function finalizeDealerDraw(state: GameState): GameState {
  if (!state.dealerDrawCards || state.dealerDrawCards.length === 0) {
    return { ...state, phase: 'setup', dealerIndex: 0 };
  }

  const getDealerDrawValue = (card: Card): number => {
    const rankValue = RANK_ORDER_ACE_LOW[card.rank];
    const suitValue = SUIT_ORDER[card.suit];
    return rankValue * 10 + suitValue;
  };

  let lowestIndex = 0;
  let lowestValue = getDealerDrawValue(state.dealerDrawCards[0].card);

  for (let i = 1; i < state.dealerDrawCards.length; i++) {
    const cardValue = getDealerDrawValue(state.dealerDrawCards[i].card);
    if (cardValue < lowestValue) {
      lowestValue = cardValue;
      lowestIndex = i;
    }
  }

  return {
    ...state,
    dealerIndex: lowestIndex,
    dealerDrawCards: state.dealerDrawCards,
  };
}

export function dealCards(state: GameState): GameState {
  const deck = shuffleDeck(createDeck());
  const newPlayers = state.players.map((player, index) => ({
    ...player,
    hand: deck.slice(index * INITIAL_HAND_SIZE, (index + 1) * INITIAL_HAND_SIZE),
    bid: null,
    tricksWon: [],
  }));

  const stock = deck.slice(4 * INITIAL_HAND_SIZE);
  const firstBidderIndex = (state.dealerIndex + 1) % 4;

  return {
    ...state,
    phase: 'bidding',
    players: newPlayers,
    currentPlayerIndex: firstBidderIndex,
    trumpSuit: null,
    highBid: 0,
    bidderId: null,
    currentTrick: [],
    trickNumber: 1,
    roundScores: {},
    stock,
    discardPile: [],
  };
}

function evaluateSuitStrength(hand: Card[], suit: Suit): { 
  trumpCount: number; 
  hasAce: boolean; 
  hasFive: boolean; 
  hasJack: boolean; 
  hasDeuce: boolean;
  hasKing: boolean;
  hasQueen: boolean;
  pointsAvailable: number;
  estimatedBid: number;
} {
  const suitCards = hand.filter(c => c.suit === suit);
  const trumpCount = suitCards.length;
  const hasAce = suitCards.some(c => c.rank === 'A');
  const hasFive = suitCards.some(c => c.rank === '5');
  const hasJack = suitCards.some(c => c.rank === 'J');
  const hasDeuce = suitCards.some(c => c.rank === '2');
  const hasKing = suitCards.some(c => c.rank === 'K');
  const hasQueen = suitCards.some(c => c.rank === 'Q');
  
  let pointsAvailable = 0;
  if (hasFive) pointsAvailable += 5;
  if (hasJack) pointsAvailable += 1;
  if (hasDeuce) pointsAvailable += 1;
  if (hasAce) pointsAvailable += 1;
  
  let estimatedBid = 0;
  
  const fiveIsVulnerable = hasFive && !hasAce && trumpCount <= 2;
  
  if (trumpCount === 0) {
    estimatedBid = 0;
  } else if (trumpCount === 1) {
    if (hasAce) estimatedBid = 5;
    else estimatedBid = 0;
  } else if (trumpCount === 2) {
    if (hasAce && hasKing) estimatedBid = 6;
    else if (hasAce && hasFive) estimatedBid = 6;
    else if (hasAce) estimatedBid = 5;
    else if (hasKing && hasFive) estimatedBid = 5;
    else estimatedBid = 0;
  } else if (trumpCount === 3) {
    if (hasAce && hasFive) estimatedBid = 7;
    else if (hasAce && hasKing) estimatedBid = 7;
    else if (hasAce) estimatedBid = 6;
    else if (hasKing && hasFive) estimatedBid = 6;
    else if (hasFive) estimatedBid = 5;
    else estimatedBid = 5;
  } else if (trumpCount >= 4) {
    if (hasAce && hasFive) estimatedBid = 8;
    else if (hasAce && hasKing) estimatedBid = 8;
    else if (hasAce) estimatedBid = 7;
    else if (hasFive) estimatedBid = 7;
    else estimatedBid = 6;
  }
  
  if ((hasJack || hasDeuce) && estimatedBid > 0) {
    estimatedBid = Math.min(9, estimatedBid + 1);
  }
  
  if (!hasAce && estimatedBid >= 8) {
    estimatedBid = 7;
  }
  
  if (fiveIsVulnerable && estimatedBid > 5) {
    estimatedBid = 5;
  }
  
  return { trumpCount, hasAce, hasFive, hasJack, hasDeuce, hasKing, hasQueen, pointsAvailable, estimatedBid };
}

export function getCpuBid(hand: Card[], highBid: number, isDealer: boolean, allPassed: boolean): number {
  if (isDealer && allPassed) {
    return MIN_BID;
  }

  const suits: Suit[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
  let bestSuitStrength = { estimatedBid: 0 } as ReturnType<typeof evaluateSuitStrength>;
  
  for (const suit of suits) {
    const strength = evaluateSuitStrength(hand, suit);
    if (strength.estimatedBid > bestSuitStrength.estimatedBid) {
      bestSuitStrength = strength;
    }
  }
  
  const myBidStrength = bestSuitStrength.estimatedBid;
  
  if (myBidStrength === 0) {
    return 0;
  }
  
  if (isDealer) {
    if (highBid === MAX_BID && myBidStrength >= MAX_BID) {
      return MAX_BID;
    }
    if (myBidStrength > highBid) {
      return highBid + 1;
    }
    return 0;
  }
  
  if (myBidStrength > highBid) {
    const bidConfidence = (myBidStrength - highBid) / 4;
    if (Math.random() < 0.5 + bidConfidence) {
      return myBidStrength;
    }
  }
  
  return 0;
}

export function getCpuTrumpChoice(hand: Card[], forcedBid: boolean = false): Suit {
  const suits: Suit[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
  const suitScores: Record<Suit, number> = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };
  const suitCounts: Record<Suit, number> = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };

  for (const card of hand) {
    suitCounts[card.suit] += 1;
    suitScores[card.suit] += 1;
    if (card.rank === '5') suitScores[card.suit] += 6;
    if (card.rank === 'J') suitScores[card.suit] += 2;
    if (card.rank === 'A') suitScores[card.suit] += 4;
    if (card.rank === 'K') suitScores[card.suit] += 2;
    if (card.rank === 'Q') suitScores[card.suit] += 1;
  }

  // "Desperate Dig" Strategy: If forced to bid with a terrible hand,
  // call a suit you have NONE of - discard everything and draw fresh
  if (forcedBid) {
    const bestScore = Math.max(...Object.values(suitScores));
    if (bestScore <= 2) {
      const emptySuits = suits.filter(s => suitCounts[s] === 0);
      if (emptySuits.length > 0) {
        return emptySuits[Math.floor(Math.random() * emptySuits.length)];
      }
    }
  }

  return Object.entries(suitScores).reduce((a, b) => (b[1] > a[1] ? b : a))[0] as Suit;
}

export function getCpuTrumpToDiscard(hand: Card[], trumpSuit: Suit): Card {
  const trumpCards = hand.filter(c => c.suit === trumpSuit);
  
  const cardValue = (card: Card): number => {
    if (card.rank === '5') return 100;
    if (card.rank === 'J') return 50;
    if (card.rank === 'A') return 40;
    if (card.rank === '2') return 30;
    if (card.rank === 'K') return 20;
    if (card.rank === 'Q') return 15;
    return RANK_ORDER[card.rank];
  };
  
  const sorted = [...trumpCards].sort((a, b) => cardValue(a) - cardValue(b));
  return sorted[0];
}

export function getCpuCardToPlay(
  hand: Card[],
  currentTrick: { playerId: string; card: Card }[],
  trumpSuit: Suit | null,
  cpuPlayerId?: string,
  allPlayers?: { id: string }[],
  bidderId?: string | null
): Card {
  const trumpCards = hand.filter(c => c.suit === trumpSuit);
  const POINT_RANKS = ['5', 'J', '2', 'A'];
  const hasPointCard = (rank: string) => hand.some(c => c.suit === trumpSuit && c.rank === rank);
  const hasFiveOfTrump = hasPointCard('5');
  const hasJackOfTrump = hasPointCard('J');
  const hasDeuceOfTrump = hasPointCard('2');
  const hasAceOfTrump = hasPointCard('A');
  
  const getPointCardInTrick = () => {
    const pointCards = currentTrick.filter(tc => 
      tc.card.suit === trumpSuit && POINT_RANKS.includes(tc.card.rank)
    );
    pointCards.sort((a, b) => {
      const priority: Record<string, number> = { '5': 0, 'J': 1, '2': 2, 'A': 3 };
      return priority[a.card.rank] - priority[b.card.rank];
    });
    return pointCards[0] || null;
  };
  
  const getTeammate = () => {
    if (!cpuPlayerId || !allPlayers) return null;
    const myIndex = allPlayers.findIndex(p => p.id === cpuPlayerId);
    if (myIndex === -1) return null;
    const teammateIndex = (myIndex + 2) % 4;
    return allPlayers[teammateIndex]?.id;
  };
  
  const getPlayersAfterMe = (): string[] => {
    if (!cpuPlayerId || !allPlayers) return [];
    const myIndex = allPlayers.findIndex(p => p.id === cpuPlayerId);
    if (myIndex === -1) return [];
    const playedIds = currentTrick.map(tc => tc.playerId);
    const result: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const idx = (myIndex + i) % 4;
      const pid = allPlayers[idx]?.id;
      if (pid && !playedIds.includes(pid)) {
        result.push(pid);
      }
    }
    return result;
  };
  
  const getCurrentWinner = (): { playerId: string; card: Card } | null => {
    if (currentTrick.length === 0) return null;
    const leadSuit = currentTrick[0].card.suit;
    let winner = currentTrick[0];
    
    for (const tc of currentTrick) {
      if (tc.card.suit === trumpSuit) {
        if (winner.card.suit !== trumpSuit || RANK_ORDER[tc.card.rank] > RANK_ORDER[winner.card.rank]) {
          winner = tc;
        }
      } else if (tc.card.suit === leadSuit && winner.card.suit !== trumpSuit) {
        if (RANK_ORDER[tc.card.rank] > RANK_ORDER[winner.card.rank]) {
          winner = tc;
        }
      }
    }
    return winner;
  };
  
  const getMyPointCards = () => trumpCards.filter(c => POINT_RANKS.includes(c.rank));
  const getNonPointTrumps = () => trumpCards.filter(c => !POINT_RANKS.includes(c.rank));

  const isBidWinner = cpuPlayerId && bidderId && cpuPlayerId === bidderId;
  
  if (currentTrick.length === 0) {
    if (trumpCards.length > 0) {
      const safeLeadTrumps = trumpCards.filter(c => 
        c.rank !== '5' && c.rank !== '2' && c.rank !== 'J'
      );
      
      if (isBidWinner) {
        if (hasAceOfTrump) {
          const aceCard = trumpCards.find(c => c.rank === 'A');
          if (aceCard) return aceCard;
        }
        const hasKingOfTrump = trumpCards.some(c => c.rank === 'K');
        if (hasKingOfTrump && trumpCards.length >= 2) {
          const kingCard = trumpCards.find(c => c.rank === 'K');
          if (kingCard) return kingCard;
        }
      }
      
      if (safeLeadTrumps.length > 0) {
        if (isBidWinner) {
          return safeLeadTrumps.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
        } else {
          return safeLeadTrumps.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
        }
      }
      
      const desperateTrumps = trumpCards.filter(c => c.rank !== '5' && c.rank !== '2');
      if (desperateTrumps.length > 0) {
        return desperateTrumps.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
      }
      
      return trumpCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
    }
    return hand.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
  }

  const leadSuit = currentTrick[0].card.suit;
  const followCards = hand.filter(c => c.suit === leadSuit);
  const teammateId = getTeammate();
  const currentWinner = getCurrentWinner();
  const teammateIsWinning = currentWinner && currentWinner.playerId === teammateId;
  const playersAfterMe = getPlayersAfterMe();
  const opponentsAfterMe = playersAfterMe.filter(pid => pid !== teammateId);
  
  const pointCardInTrick = getPointCardInTrick();
  const teammateHasPointCard = pointCardInTrick && pointCardInTrick.playerId === teammateId;
  
  if (teammateIsWinning && opponentsAfterMe.length === 0) {
    if (hasFiveOfTrump) {
      const fiveCard = trumpCards.find(c => c.rank === '5');
      if (fiveCard && canPlayCard(fiveCard, hand, currentTrick, trumpSuit)) {
        return fiveCard;
      }
    }
    if (hasDeuceOfTrump) {
      const deuceCard = trumpCards.find(c => c.rank === '2');
      if (deuceCard && canPlayCard(deuceCard, hand, currentTrick, trumpSuit)) {
        return deuceCard;
      }
    }
  }

  if (pointCardInTrick && !teammateHasPointCard) {
    const targetRank = RANK_ORDER[pointCardInTrick.card.rank];
    
    if (followCards.length > 0 && leadSuit === trumpSuit) {
      const winningCards = followCards.filter(c => RANK_ORDER[c.rank] > targetRank);
      if (winningCards.length > 0) {
        const nonPointWinners = winningCards.filter(c => !POINT_RANKS.includes(c.rank) || c.rank === 'A');
        if (nonPointWinners.length > 0) {
          return nonPointWinners.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
        }
        return winningCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
      }
    }
    
    if (followCards.length === 0 && trumpCards.length > 0) {
      const highestTrickTrump = currentTrick
        .filter(tc => tc.card.suit === trumpSuit)
        .reduce((max, tc) => Math.max(max, RANK_ORDER[tc.card.rank]), -1);
      
      const winningTrumps = trumpCards.filter(c => RANK_ORDER[c.rank] > highestTrickTrump);
      if (winningTrumps.length > 0) {
        const nonPointWinners = winningTrumps.filter(c => !POINT_RANKS.includes(c.rank) || c.rank === 'A');
        if (nonPointWinners.length > 0) {
          return nonPointWinners.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
        }
        if (hasAceOfTrump) {
          const aceCard = trumpCards.find(c => c.rank === 'A');
          if (aceCard) return aceCard;
        }
        return winningTrumps.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
      }
    }
  }

  if (followCards.length > 0) {
    const safeFollowCards = followCards.filter(c => !POINT_RANKS.includes(c.rank) || c.rank === 'A');
    const valuablePointCards = followCards.filter(c => c.rank === '5' || c.rank === 'J' || c.rank === '2');
    
    if (leadSuit === trumpSuit) {
      if (currentWinner && !teammateIsWinning) {
        const winningCards = safeFollowCards.filter(c => RANK_ORDER[c.rank] > RANK_ORDER[currentWinner.card.rank]);
        if (winningCards.length > 0) {
          return winningCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
        }
        
        if (safeFollowCards.length > 0) {
          return safeFollowCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
        }
        
        if (valuablePointCards.length > 0) {
          const deuceCard = valuablePointCards.find(c => c.rank === '2');
          const jackCard = valuablePointCards.find(c => c.rank === 'J');
          const fiveCard = valuablePointCards.find(c => c.rank === '5');
          if (deuceCard) return deuceCard;
          if (jackCard) return jackCard;
          if (fiveCard) return fiveCard;
        }
      }
      
      if (safeFollowCards.length > 0) {
        return safeFollowCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
      }
      
      if (teammateIsWinning && opponentsAfterMe.length === 0) {
        if (hasFiveOfTrump) {
          const fiveCard = followCards.find(c => c.rank === '5');
          if (fiveCard) return fiveCard;
        }
      }
      
      const deuceCard = followCards.find(c => c.rank === '2');
      const jackCard = followCards.find(c => c.rank === 'J');
      const fiveCard = followCards.find(c => c.rank === '5');
      if (deuceCard) return deuceCard;
      if (jackCard) return jackCard;
      if (fiveCard) return fiveCard;
      
      return followCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
    }
    
    if (teammateIsWinning) {
      return followCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
    }
    return followCards.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
  }

  if (trumpCards.length > 0) {
    const shouldProtect = 
      !hasFiveOfTrump && 
      !pointCardInTrick && 
      leadSuit !== trumpSuit && 
      opponentsAfterMe.length > 0 && 
      !teammateIsWinning;
    
    if (shouldProtect) {
      const protectiveTrumps = trumpCards.filter(c => RANK_ORDER[c.rank] > RANK_ORDER['5'] && c.rank !== 'A');
      const highestTrickTrump = currentTrick
        .filter(tc => tc.card.suit === trumpSuit)
        .reduce((max, tc) => Math.max(max, RANK_ORDER[tc.card.rank]), -1);
      
      const winningProtectiveTrumps = protectiveTrumps.filter(c => RANK_ORDER[c.rank] > highestTrickTrump);
      
      if (winningProtectiveTrumps.length > 0) {
        return winningProtectiveTrumps.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
      }
      
      if (hasAceOfTrump && opponentsAfterMe.length > 0) {
        const aceCard = trumpCards.find(c => c.rank === 'A');
        if (aceCard) return aceCard;
      }
    }
    
    const nonPointTrumps = getNonPointTrumps();
    if (nonPointTrumps.length > 0) {
      return nonPointTrumps.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
    }
    
    if (hasAceOfTrump) {
      const aceCard = trumpCards.find(c => c.rank === 'A');
      if (aceCard) return aceCard;
    }
    
    return trumpCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
  }

  return hand.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
}

export function processBid(state: GameState, bid: number): GameState {
  const newPlayers = [...state.players];
  const isDealer = state.currentPlayerIndex === state.dealerIndex;
  newPlayers[state.currentPlayerIndex] = {
    ...newPlayers[state.currentPlayerIndex],
    bid,
  };

  let newHighBid = state.highBid;
  let newBidderId = state.bidderId;

  if (bid > state.highBid) {
    newHighBid = bid;
    newBidderId = newPlayers[state.currentPlayerIndex].id;
  } else if (isDealer && bid === MAX_BID && state.highBid === MAX_BID) {
    newBidderId = newPlayers[state.currentPlayerIndex].id;
  }

  const nextPlayerIndex = (state.currentPlayerIndex + 1) % 4;
  const allBid = newPlayers.every(p => p.bid !== null);

  if (allBid) {
    if (newHighBid === 0) {
      const dealerPlayer = newPlayers[state.dealerIndex];
      newHighBid = MIN_BID;
      newBidderId = dealerPlayer.id;
      newPlayers[state.dealerIndex] = { ...dealerPlayer, bid: MIN_BID };
    }

    const bidderIndex = newPlayers.findIndex(p => p.id === newBidderId);

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
  return {
    ...state,
    trumpSuit: suit,
    phase: 'purge-draw' as const,
  };
}

export function performPurgeAndDraw(state: GameState): GameState {
  const trumpSuit = state.trumpSuit!;
  let stock = [...state.stock];
  let discardPile = [...state.discardPile];
  const bidderIndex = state.players.findIndex(p => p.id === state.bidderId);

  const playersNeedingDiscard: number[] = [];

  const newPlayers = state.players.map((player, index) => {
    const trumpCards = player.hand.filter(c => c.suit === trumpSuit);
    const nonTrumpCards = player.hand.filter(c => c.suit !== trumpSuit);

    discardPile = [...discardPile, ...nonTrumpCards];

    let keptCards: Card[];
    if (trumpCards.length > FINAL_HAND_SIZE) {
      playersNeedingDiscard.push(index);
      keptCards = trumpCards;
    } else {
      keptCards = trumpCards;
    }

    return { ...player, hand: keptCards };
  });

  if (playersNeedingDiscard.length > 0) {
    const firstPlayerToDiscard = playersNeedingDiscard[0];
    return {
      ...state,
      players: newPlayers,
      stock,
      discardPile,
      phase: 'discard-trump',
      playersNeedingDiscard,
      currentPlayerIndex: firstPlayerToDiscard,
    };
  }

  const drawOrder = [
    bidderIndex,
    (bidderIndex + 1) % 4,
    (bidderIndex + 2) % 4,
    (bidderIndex + 3) % 4,
  ];

  for (const playerIndex of drawOrder) {
    const player = newPlayers[playerIndex];
    const cardsToDraw = FINAL_HAND_SIZE - player.hand.length;

    for (let i = 0; i < cardsToDraw; i++) {
      if (stock.length === 0 && discardPile.length > 0) {
        stock = shuffleDeck(discardPile);
        discardPile = [];
      }
      if (stock.length > 0) {
        player.hand.push(stock.pop()!);
      }
    }
  }

  // Slept cards are ONLY the remaining undrawn stock cards
  const sleptCards = [...stock];

  return {
    ...state,
    players: newPlayers,
    stock,
    discardPile,
    sleptCards,
    phase: 'playing',
    currentPlayerIndex: bidderIndex,
    leadPlayerIndex: bidderIndex,
  };
}

export function discardTrumpCard(state: GameState, card: Card): GameState {
  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex];
  
  const cardInHand = player.hand.find(c => c.id === card.id);
  if (!cardInHand) {
    return state;
  }
  
  if (cardInHand.suit !== state.trumpSuit) {
    return state;
  }
  
  const newHand = player.hand.filter(c => c.id !== card.id);
  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...player, hand: newHand };
  
  const newDiscardPile = [...state.discardPile, card];
  
  const remainingPlayersNeedingDiscard = (state.playersNeedingDiscard || []).filter(idx => {
    if (idx === playerIndex) {
      return newHand.length > FINAL_HAND_SIZE;
    }
    return newPlayers[idx].hand.length > FINAL_HAND_SIZE;
  });
  
  if (remainingPlayersNeedingDiscard.length > 0) {
    const nextPlayerToDiscard = remainingPlayersNeedingDiscard[0];
    return {
      ...state,
      players: newPlayers,
      discardPile: newDiscardPile,
      playersNeedingDiscard: remainingPlayersNeedingDiscard,
      currentPlayerIndex: nextPlayerToDiscard,
    };
  }
  
  const bidderIndex = state.players.findIndex(p => p.id === state.bidderId);
  let stock = [...state.stock];
  let discardPile = newDiscardPile;
  
  // Create deep copies of all players to avoid mutating original state
  const playersForDraw = newPlayers.map(p => ({ ...p, hand: [...p.hand] }));
  
  const drawOrder = [
    bidderIndex,
    (bidderIndex + 1) % 4,
    (bidderIndex + 2) % 4,
    (bidderIndex + 3) % 4,
  ];

  for (const pIndex of drawOrder) {
    const p = playersForDraw[pIndex];
    const cardsToDraw = FINAL_HAND_SIZE - p.hand.length;

    for (let i = 0; i < cardsToDraw; i++) {
      if (stock.length === 0 && discardPile.length > 0) {
        stock = shuffleDeck(discardPile);
        discardPile = [];
      }
      if (stock.length > 0) {
        p.hand.push(stock.pop()!);
      }
    }
  }

  // Slept cards are ONLY the remaining undrawn stock cards
  const sleptCards = [...stock];

  return {
    ...state,
    players: playersForDraw,
    stock,
    discardPile,
    sleptCards,
    playersNeedingDiscard: [],
    phase: 'playing',
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

    const scoreDetails = calculateRoundScores(newPlayers, state.teams, state.trumpSuit!);
    const bidderTeamId = newPlayers.find(p => p.id === state.bidderId)?.teamId;
    
    // Check for early game-over conditions:
    // 1. Non-bidding team can win mid-round if they reach target (can't be set)
    // 2. Bidding team can win mid-round if they reach target AND have made their bid
    const nonBidderTeam = state.teams.find(t => t.id !== bidderTeamId);
    const bidderTeam = state.teams.find(t => t.id === bidderTeamId);
    const nonBidderPoints = scoreDetails.teamPoints[nonBidderTeam?.id || ''] || 0;
    const bidderPoints = scoreDetails.teamPoints[bidderTeamId || ''] || 0;
    const nonBidderCurrentScore = (nonBidderTeam?.score || 0) + nonBidderPoints;
    const bidderCurrentScore = (bidderTeam?.score || 0) + bidderPoints;
    const bidderMadeBid = bidderPoints >= state.highBid;
    
    // Early game-over if non-bidder hits 25+, or bidder hits 25+ AND made their bid
    const earlyGameOver = nonBidderCurrentScore >= state.targetScore || 
      (bidderCurrentScore >= state.targetScore && bidderMadeBid);
    
    if (newTrickNumber > TOTAL_TRICKS || earlyGameOver) {
      const newTeams = state.teams.map(team => {
        let pointsToAdd = scoreDetails.teamPoints[team.id];
        
        // Only apply set penalty at end of round, not for early game-over
        if (!earlyGameOver && team.id === bidderTeamId && pointsToAdd < state.highBid) {
          pointsToAdd = -state.highBid;
        }
        
        return {
          ...team,
          score: team.score + pointsToAdd,
        };
      });

      // Game ends when any team reaches target score
      const gameOver = newTeams.some(t => t.score >= state.targetScore);

      return {
        ...state,
        players: newPlayers,
        teams: newTeams,
        currentTrick: [],
        lastTrick: newTrick,
        lastTrickWinnerId: winnerId,
        trickNumber: newTrickNumber,
        phase: gameOver ? 'game-over' : 'scoring',
        roundScores: scoreDetails.teamPoints,
        roundScoreDetails: scoreDetails,
      };
    }

    return {
      ...state,
      players: newPlayers,
      currentTrick: [],
      lastTrick: newTrick,
      lastTrickWinnerId: winnerId,
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

export function canPlayCard(card: Card, hand: Card[], currentTrick: { playerId: string; card: Card }[], trumpSuit?: Suit | null): boolean {
  // First card of trick - can play anything
  if (currentTrick.length === 0) {
    return true;
  }
  
  const leadSuit = currentTrick[0].card.suit;
  
  // If playing the lead suit, always valid
  if (card.suit === leadSuit) {
    return true;
  }
  
  // PITCH RULE: You can ALWAYS play trump, even if you have the lead suit
  if (trumpSuit && card.suit === trumpSuit) {
    return true;
  }
  
  // If you don't have the lead suit, you can play anything
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);
  if (!hasLeadSuit) {
    return true;
  }

  // You have the lead suit but are trying to play a non-trump off-suit - not allowed
  return false;
}

export function startNewRound(state: GameState): GameState {
  const newDealerIndex = (state.dealerIndex + 1) % 4;
  return dealCards({
    ...state,
    dealerIndex: newDealerIndex,
    players: state.players.map(p => ({ ...p, tricksWon: [], bid: null })),
  });
}

export function checkGameOver(state: GameState): boolean {
  return state.teams.some(t => t.score >= state.targetScore);
}

export function getWinningTeam(state: GameState): Team | null {
  const teamsAt25 = state.teams.filter(t => t.score >= state.targetScore);
  
  if (teamsAt25.length === 0) {
    // No team at target - check for max score (shouldn't happen in game-over)
    const maxScore = Math.max(...state.teams.map(t => t.score));
    const winners = state.teams.filter(t => t.score === maxScore);
    return winners.length === 1 ? winners[0] : null;
  }
  
  if (teamsAt25.length === 1) {
    return teamsAt25[0];
  }
  
  // Both teams at 25+ - bidder wins if they made their bid, otherwise highest score
  const bidderTeamId = state.players.find(p => p.id === state.bidderId)?.teamId;
  const bidderTeam = teamsAt25.find(t => t.id === bidderTeamId);
  const nonBidderTeam = teamsAt25.find(t => t.id !== bidderTeamId);
  
  // If bidder made their bid (they're at 25+ without being set), they win
  if (bidderTeam && state.roundScores) {
    const bidderPoints = state.roundScores[bidderTeamId!] || 0;
    if (bidderPoints >= state.highBid) {
      return bidderTeam;
    }
  }
  
  // Otherwise highest score wins, or non-bidder if tied
  if (bidderTeam && nonBidderTeam) {
    if (bidderTeam.score > nonBidderTeam.score) return bidderTeam;
    return nonBidderTeam;
  }
  
  return teamsAt25[0];
}

export function isPlayersTurn(state: GameState, playerId: string): boolean {
  return state.players[state.currentPlayerIndex].id === playerId;
}

export function applyAutoClaim(state: GameState, claimerId: string): GameState {
  const newPlayers = state.players.map(player => {
    if (player.id === claimerId) {
      const allRemainingCards = state.players.flatMap(p => p.hand);
      return {
        ...player,
        hand: [],
        tricksWon: [...player.tricksWon, ...allRemainingCards],
      };
    }
    return { ...player, hand: [] };
  });

  const scoreDetails = calculateRoundScores(newPlayers, state.teams, state.trumpSuit!);
  const bidderTeamId = newPlayers.find(p => p.id === state.bidderId)?.teamId;
  
  const newTeams = state.teams.map(team => {
    let pointsToAdd = scoreDetails.teamPoints[team.id];
    
    if (team.id === bidderTeamId && pointsToAdd < state.highBid) {
      pointsToAdd = -state.highBid;
    }
    
    return {
      ...team,
      score: team.score + pointsToAdd,
    };
  });

  // Game ends when any team reaches target score (set penalty already applied above)
  const gameOver = newTeams.some(t => t.score >= state.targetScore);

  return {
    ...state,
    players: newPlayers,
    teams: newTeams,
    currentTrick: [],
    trickNumber: TOTAL_TRICKS + 1,
    phase: gameOver ? 'game-over' : 'scoring',
    roundScores: scoreDetails.teamPoints,
    roundScoreDetails: scoreDetails,
    autoClaimerId: claimerId,
  };
}
