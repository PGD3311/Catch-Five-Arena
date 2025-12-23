import { 
  type User, 
  type InsertUser, 
  type GameRoom, 
  type InsertGameRoom,
  type RoomPlayer,
  type InsertRoomPlayer 
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createRoom(room: InsertGameRoom): Promise<GameRoom>;
  getRoomByCode(code: string): Promise<GameRoom | undefined>;
  getRoomById(id: string): Promise<GameRoom | undefined>;
  updateRoom(id: string, updates: Partial<GameRoom>): Promise<GameRoom | undefined>;
  deleteRoom(id: string): Promise<void>;
  
  addPlayerToRoom(player: InsertRoomPlayer): Promise<RoomPlayer>;
  getPlayersInRoom(roomId: string): Promise<RoomPlayer[]>;
  getPlayerByToken(token: string): Promise<RoomPlayer | undefined>;
  updatePlayer(id: string, updates: Partial<RoomPlayer>): Promise<RoomPlayer | undefined>;
  removePlayerFromRoom(playerId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private rooms: Map<string, GameRoom>;
  private players: Map<string, RoomPlayer>;

  constructor() {
    this.users = new Map();
    this.rooms = new Map();
    this.players = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createRoom(insertRoom: InsertGameRoom): Promise<GameRoom> {
    const id = randomUUID();
    const room: GameRoom = {
      id,
      code: insertRoom.code,
      hostPlayerId: insertRoom.hostPlayerId ?? null,
      deckColor: insertRoom.deckColor ?? 'blue',
      targetScore: insertRoom.targetScore ?? 31,
      status: insertRoom.status ?? 'waiting',
      gameState: insertRoom.gameState ?? null,
      createdAt: new Date(),
    };
    this.rooms.set(id, room);
    return room;
  }

  async getRoomByCode(code: string): Promise<GameRoom | undefined> {
    return Array.from(this.rooms.values()).find(room => room.code === code);
  }

  async getRoomById(id: string): Promise<GameRoom | undefined> {
    return this.rooms.get(id);
  }

  async updateRoom(id: string, updates: Partial<GameRoom>): Promise<GameRoom | undefined> {
    const room = this.rooms.get(id);
    if (!room) return undefined;
    const updated = { ...room, ...updates };
    this.rooms.set(id, updated);
    return updated;
  }

  async deleteRoom(id: string): Promise<void> {
    this.rooms.delete(id);
    const playersToDelete = Array.from(this.players.entries())
      .filter(([_, player]) => player.roomId === id)
      .map(([playerId]) => playerId);
    playersToDelete.forEach(playerId => this.players.delete(playerId));
  }

  async addPlayerToRoom(insertPlayer: InsertRoomPlayer): Promise<RoomPlayer> {
    const id = randomUUID();
    const player: RoomPlayer = {
      id,
      roomId: insertPlayer.roomId,
      seatIndex: insertPlayer.seatIndex,
      playerToken: insertPlayer.playerToken,
      playerName: insertPlayer.playerName,
      isHuman: insertPlayer.isHuman ?? true,
      isConnected: insertPlayer.isConnected ?? false,
      joinedAt: new Date(),
    };
    this.players.set(id, player);
    return player;
  }

  async getPlayersInRoom(roomId: string): Promise<RoomPlayer[]> {
    return Array.from(this.players.values()).filter(p => p.roomId === roomId);
  }

  async getPlayerByToken(token: string): Promise<RoomPlayer | undefined> {
    return Array.from(this.players.values()).find(p => p.playerToken === token);
  }

  async updatePlayer(id: string, updates: Partial<RoomPlayer>): Promise<RoomPlayer | undefined> {
    const player = this.players.get(id);
    if (!player) return undefined;
    const updated = { ...player, ...updates };
    this.players.set(id, updated);
    return updated;
  }

  async removePlayerFromRoom(playerId: string): Promise<void> {
    this.players.delete(playerId);
  }
}

export const storage = new MemStorage();
