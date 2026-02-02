import { WebSocket, WebSocketServer } from 'ws';
import { playerConnections, spectatorConnections, rooms } from './ws/state';
import { handlePlayerDisconnect } from './ws/roomManager';
import { handleSpectatorDisconnect } from './ws/spectatorManager';
import {
  handleCreateRoom, handleJoinRoom, handleLeaveRoom,
  handleAddCpu, handleRemoveCpu, handleKickPlayer,
  handleSwapSeats, handleRandomizeTeams, handlePreviewRoom,
} from './ws/roomManager';
import { handleStartGame, handlePlayerAction } from './ws/gameSync';
import { handleSpectateRoom, handleLeaveSpectate, handleListActiveGames } from './ws/spectatorManager';
import { handleSendChat } from './ws/chatManager';
import { log } from './index';
import type { GameRoom } from './ws/types';

export function initializeWebSocket(server: any): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    log('WebSocket client connected', 'ws');

    (ws as any).isAlive = true;
    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'ping') {
          (ws as any).isAlive = true;
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        await handleMessage(ws, message);
      } catch (error) {
        log(`WebSocket error: ${error}`, 'ws');
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('error', (err) => {
      log(`WebSocket error on connection: ${err.message}`, 'ws');
    });

    ws.on('close', () => {
      const player = playerConnections.get(ws);
      if (player) {
        handlePlayerDisconnect(player);
        playerConnections.delete(ws);
      }
      const spectator = spectatorConnections.get(ws);
      if (spectator) {
        handleSpectatorDisconnect(spectator);
      }
      log('WebSocket client disconnected', 'ws');
    });
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      const missCount = (ws as any).missCount || 0;
      if ((ws as any).isAlive === false) {
        (ws as any).missCount = missCount + 1;
        if (missCount >= 2) {
          const player = playerConnections.get(ws);
          if (player) {
            handlePlayerDisconnect(player);
            playerConnections.delete(ws);
          }
          const spectator = spectatorConnections.get(ws);
          if (spectator) {
            handleSpectatorDisconnect(spectator);
          }
          return ws.terminate();
        }
      } else {
        (ws as any).missCount = 0;
      }
      (ws as any).isAlive = false;
      ws.ping();
    });
  }, 45000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}

async function handleMessage(ws: WebSocket, message: any) {
  switch (message.type) {
    case 'create_room':
      await handleCreateRoom(ws, message);
      break;
    case 'join_room':
      await handleJoinRoom(ws, message);
      break;
    case 'start_game':
      await handleStartGame(ws);
      break;
    case 'player_action':
      await handlePlayerAction(ws, message);
      break;
    case 'leave_room':
      await handleLeaveRoom(ws);
      break;
    case 'add_cpu':
      await handleAddCpu(ws, message);
      break;
    case 'remove_cpu':
      await handleRemoveCpu(ws, message);
      break;
    case 'kick_player':
      await handleKickPlayer(ws, message);
      break;
    case 'swap_seats':
      await handleSwapSeats(ws, message);
      break;
    case 'randomize_teams':
      await handleRandomizeTeams(ws);
      break;
    case 'send_chat':
      await handleSendChat(ws, message);
      break;
    case 'preview_room':
      handlePreviewRoom(ws, message);
      break;
    case 'spectate_room':
      handleSpectateRoom(ws, message);
      break;
    case 'leave_spectate':
      handleLeaveSpectate(ws);
      break;
    case 'list_active_games':
      handleListActiveGames(ws);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

export function getRoomByCode(code: string): GameRoom | undefined {
  return rooms.get(code);
}
