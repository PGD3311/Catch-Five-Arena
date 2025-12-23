import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState, Card, Suit, DeckColor } from '@shared/gameTypes';

interface RoomPlayer {
  seatIndex: number;
  playerName: string;
  connected: boolean;
  isCpu?: boolean;
}

interface MultiplayerState {
  connected: boolean;
  roomCode: string | null;
  playerToken: string | null;
  seatIndex: number | null;
  players: RoomPlayer[];
  gameState: GameState | null;
  error: string | null;
}

export function useMultiplayer() {
  const [state, setState] = useState<MultiplayerState>({
    connected: false,
    roomCode: null,
    playerToken: null,
    seatIndex: null,
    players: [],
    gameState: null,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState(prev => ({ ...prev, connected: true, error: null }));
      reconnectAttempts.current = 0;

      const savedToken = sessionStorage.getItem('playerToken');
      const savedRoom = sessionStorage.getItem('roomCode');
      if (savedToken && savedRoom) {
        ws.send(JSON.stringify({
          type: 'join_room',
          roomCode: savedRoom,
          playerToken: savedToken,
        }));
      }
      
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
      
      (ws as any).pingInterval = pingInterval;
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };

    ws.onclose = () => {
      if ((ws as any).pingInterval) {
        clearInterval((ws as any).pingInterval);
      }
      setState(prev => ({ ...prev, connected: false }));
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        setTimeout(connect, 1000 * Math.pow(2, reconnectAttempts.current));
      }
    };

    ws.onerror = () => {
      setState(prev => ({ ...prev, error: 'Connection error' }));
    };
  }, []);

  const handleMessage = (message: any) => {
    switch (message.type) {
      case 'room_created':
      case 'joined':
        sessionStorage.setItem('playerToken', message.playerToken);
        sessionStorage.setItem('roomCode', message.roomCode);
        setState(prev => ({
          ...prev,
          roomCode: message.roomCode,
          playerToken: message.playerToken,
          seatIndex: message.seatIndex,
          players: message.players,
          error: null,
        }));
        break;

      case 'rejoined':
        setState(prev => ({
          ...prev,
          roomCode: message.roomCode,
          playerToken: message.playerToken,
          seatIndex: message.seatIndex,
          players: message.players,
          gameState: message.gameState,
          error: null,
        }));
        break;

      case 'player_joined':
      case 'player_reconnected':
      case 'player_disconnected':
        setState(prev => ({
          ...prev,
          players: message.players || prev.players,
        }));
        break;

      case 'seats_updated':
        setState(prev => ({
          ...prev,
          seatIndex: message.seatIndex,
          players: message.players || prev.players,
        }));
        break;

      case 'game_state':
        setState(prev => ({
          ...prev,
          gameState: message.gameState,
        }));
        break;

      case 'left':
        sessionStorage.removeItem('playerToken');
        sessionStorage.removeItem('roomCode');
        setState({
          connected: true,
          roomCode: null,
          playerToken: null,
          seatIndex: null,
          players: [],
          gameState: null,
          error: null,
        });
        break;

      case 'error':
        setState(prev => ({ ...prev, error: message.message }));
        break;
      
      case 'pong':
        break;
    }
  };

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const createRoom = useCallback((playerName: string, deckColor: DeckColor = 'orange', targetScore: number = 25) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'create_room',
        playerName,
        deckColor,
        targetScore,
      }));
    }
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'join_room',
        roomCode,
        playerName,
      }));
    }
  }, []);

  const startGame = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start_game' }));
    }
  }, []);

  const sendAction = useCallback((action: string, data: any = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'player_action',
        action,
        data,
      }));
    }
  }, []);

  const leaveRoom = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave_room' }));
    }
  }, []);

  const addCpu = useCallback((seatIndex: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'add_cpu', seatIndex }));
    }
  }, []);

  const removeCpu = useCallback((seatIndex: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'remove_cpu', seatIndex }));
    }
  }, []);

  const swapSeats = useCallback((seat1: number, seat2: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'swap_seats', seat1, seat2 }));
    }
  }, []);

  const randomizeTeams = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'randomize_teams' }));
    }
  }, []);

  return {
    ...state,
    createRoom,
    joinRoom,
    startGame,
    sendAction,
    leaveRoom,
    addCpu,
    removeCpu,
    swapSeats,
    randomizeTeams,
  };
}
