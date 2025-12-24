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
} from '@shared/gameTypes';

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

export function initializeGame(deckColor: DeckColor = 'orange', targetScore: number = DEFAULT_TARGET_SCORE): GameState {
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
  
  // Strategic bidding based on expert play:
  // - Ace + King = safe bid of 5 (2 sure points, likely catch J/Game/maybe 5)
  // - Holding 5 = only safe if protected by Ace or 4+ trumps
  // - No trumps = always pass
  
  const hasHighControl = hasAce || (hasKing && trumpCount >= 3);
  const fiveIsProtected = hasFive && (hasAce || trumpCount >= 4);
  const fiveIsVulnerable = hasFive && !hasAce && trumpCount <= 2;
  
  if (trumpCount === 0) {
    estimatedBid = 0;
  } else if (trumpCount === 1) {
    // Single trump: only bid with Ace (controls the suit)
    if (hasAce) estimatedBid = 5;
    else estimatedBid = 0; // Even the 5 alone is too risky
  } else if (trumpCount === 2) {
    if (hasAce && hasKing) estimatedBid = 6; // Strong control
    else if (hasAce && hasFive) estimatedBid = 6; // Protected 5
    else if (hasAce) estimatedBid = 5;
    else if (hasKing && hasFive) estimatedBid = 5; // Risky but playable
    else estimatedBid = 0; // No control, don't bid
  } else if (trumpCount === 3) {
    if (hasAce && hasFive) estimatedBid = 7;
    else if (hasAce && hasKing) estimatedBid = 7;
    else if (hasAce) estimatedBid = 6;
    else if (hasKing && hasFive) estimatedBid = 6;
    else if (hasFive) estimatedBid = 5; // 3 trumps gives some protection
    else estimatedBid = 5;
  } else if (trumpCount >= 4) {
    // 4+ trumps = strong trump control
    if (hasAce && hasFive) estimatedBid = 8;
    else if (hasAce && hasKing) estimatedBid = 8;
    else if (hasAce) estimatedBid = 7;
    else if (hasFive) estimatedBid = 7; // 4+ trumps protects the 5
    else estimatedBid = 6;
  }
  
  // Bonus for Jack or Deuce (extra point cards)
  if ((hasJack || hasDeuce) && estimatedBid > 0) {
    estimatedBid = Math.min(9, estimatedBid + 1);
  }
  
  // Cap at 7 without Ace (no trump control for high bids)
  if (!hasAce && estimatedBid >= 8) {
    estimatedBid = 7;
  }
  
  // The 5 is a liability without protection - cap conservative
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
  // call a suit you have NONE of - you'll discard everything and draw 6 fresh cards
  // hoping to get the Ace or 5 of that suit
  if (forcedBid) {
    const bestScore = Math.max(...Object.values(suitScores));
    // If our best suit is terrible (low score), try digging
    if (bestScore <= 2) {
      const emptySuits = suits.filter(s => suitCounts[s] === 0);
      if (emptySuits.length > 0) {
        // Pick a random empty suit to "Hail Mary" dig
        return emptySuits[Math.floor(Math.random() * emptySuits.length)];
      }
    }
  }

  return Object.entries(suitScores).reduce((a, b) => (b[1] > a[1] ? b : a))[0] as Suit;
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

  // LEADING STRATEGY (when starting a trick)
  const isBidWinner = cpuPlayerId && bidderId && cpuPlayerId === bidderId;
  
  if (currentTrick.length === 0) {
    if (trumpCards.length > 0) {
      // Key rules for ALL players:
      // - NEVER lead the 5 (vulnerable to capture)
      // - NEVER lead the 2 (opponent wins trick and steals Low point)
      const safeLeadTrumps = trumpCards.filter(c => 
        c.rank !== '5' && c.rank !== '2' && c.rank !== 'J'
      );
      
      // BID WINNER STRATEGY: Lead high trumps (Ace/King) to "hunt" for opponent's 5
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
      
      // DEFENDER STRATEGY: Lead small/medium trumps to probe, save high cards
      // Lead safe non-point trumps (not 5, 2, or J)
      if (safeLeadTrumps.length > 0) {
        if (isBidWinner) {
          // Bidder leads highest to bleed opponents
          return safeLeadTrumps.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
        } else {
          // Defender leads lower trumps to probe ("Partner Check" lead)
          return safeLeadTrumps.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
        }
      }
      
      // Only lead point cards as last resort (but never 5 or 2)
      const desperateTrumps = trumpCards.filter(c => c.rank !== '5' && c.rank !== '2');
      if (desperateTrumps.length > 0) {
        return desperateTrumps.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
      }
      
      // Absolute last resort - play lowest trump (probably stuck with just 5 or 2)
      return trumpCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
    }
    // No trumps - lead highest non-trump
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
  
  // SAVE POINT CARDS STRATEGY: Play 5 or 2 on partner's winning trick
  // The 5 should be dropped on a trick partner is winning to save it
  // The 2 (Low) should be played on partner's winning trick to secure the Low point
  if (teammateIsWinning && opponentsAfterMe.length === 0) {
    // Safe to drop point cards on partner's winning trick
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
    const myPointCards = getMyPointCards();
    // Safe cards: non-point cards OR Ace (Ace is worth fighting for High)
    const safeFollowCards = followCards.filter(c => !POINT_RANKS.includes(c.rank) || c.rank === 'A');
    // Cards we should NEVER throw away if we can help it: 5, J, 2
    const valuablePointCards = followCards.filter(c => c.rank === '5' || c.rank === 'J' || c.rank === '2');
    
    if (leadSuit === trumpSuit) {
      // Following trump suit - be careful with point cards!
      
      // If opponent is winning, try to beat them with safe cards first
      if (currentWinner && !teammateIsWinning) {
        // Can we win with a non-point card?
        const winningCards = safeFollowCards.filter(c => RANK_ORDER[c.rank] > RANK_ORDER[currentWinner.card.rank]);
        if (winningCards.length > 0) {
          // Use lowest winning card
          return winningCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
        }
        
        // Can't win - play lowest non-point trump to minimize loss
        if (safeFollowCards.length > 0) {
          return safeFollowCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
        }
        
        // Only have point cards left - play the lowest value one (2 is worth less than J, J is worth less than 5)
        // Priority: play 2 before J, play J before 5 (5 is most valuable)
        if (valuablePointCards.length > 0) {
          const deuceCard = valuablePointCards.find(c => c.rank === '2');
          const jackCard = valuablePointCards.find(c => c.rank === 'J');
          const fiveCard = valuablePointCards.find(c => c.rank === '5');
          // 2 is least valuable point card, then J, then 5
          if (deuceCard) return deuceCard;
          if (jackCard) return jackCard;
          if (fiveCard) return fiveCard;
        }
      }
      
      // Teammate is winning or we're in a good position
      if (safeFollowCards.length > 0) {
        // Play lowest safe card
        return safeFollowCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
      }
      
      // Only point cards left - if teammate winning, safe to drop. Otherwise play lowest value.
      if (teammateIsWinning && opponentsAfterMe.length === 0) {
        // Safe to drop 5 or 2 on partner's trick
        if (hasFiveOfTrump) {
          const fiveCard = followCards.find(c => c.rank === '5');
          if (fiveCard) return fiveCard;
        }
      }
      
      // Play lowest value point card (prefer losing 2 over J over 5)
      const deuceCard = followCards.find(c => c.rank === '2');
      const jackCard = followCards.find(c => c.rank === 'J');
      const fiveCard = followCards.find(c => c.rank === '5');
      if (deuceCard) return deuceCard;
      if (jackCard) return jackCard;
      if (fiveCard) return fiveCard;
      
      // Fallback
      return followCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
    }
    
    // Following non-trump suit - play highest to try to win, or lowest to conserve
    if (teammateIsWinning) {
      // Partner winning - play lowest
      return followCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
    }
    // Try to win with highest
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
  return performPurgeAndDraw({
    ...state,
    trumpSuit: suit,
  });
}

export function performPurgeAndDraw(state: GameState): GameState {
  const trumpSuit = state.trumpSuit!;
  let stock = [...state.stock];
  let discardPile = [...state.discardPile];
  const bidderIndex = state.players.findIndex(p => p.id === state.bidderId);

  const newPlayers = state.players.map((player) => {
    const trumpCards = player.hand.filter(c => c.suit === trumpSuit);
    const nonTrumpCards = player.hand.filter(c => c.suit !== trumpSuit);

    discardPile = [...discardPile, ...nonTrumpCards];

    let keptCards: Card[];
    if (trumpCards.length >= INITIAL_HAND_SIZE) {
      keptCards = trumpCards
        .sort((a, b) => RANK_ORDER[b.rank] - RANK_ORDER[a.rank])
        .slice(0, FINAL_HAND_SIZE);
      discardPile = [...discardPile, ...trumpCards.slice(FINAL_HAND_SIZE)];
    } else {
      keptCards = trumpCards;
    }

    return { ...player, hand: keptCards };
  });

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

  return {
    ...state,
    players: newPlayers,
    stock,
    discardPile,
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

    if (newTrickNumber > TOTAL_TRICKS) {
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
  if (currentTrick.length === 0) return true;

  const leadSuit = currentTrick[0].card.suit;
  
  // In Catch 5, you can always play trump regardless of what you have
  if (trumpSuit && card.suit === trumpSuit) {
    return true;
  }
  
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);

  if (hasLeadSuit) {
    return card.suit === leadSuit;
  }

  return true;
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
