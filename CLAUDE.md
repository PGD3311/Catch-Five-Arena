# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start dev server (tsx + Vite HMR)
npm run build        # Production build (Vite client + esbuild server)
npm run check        # TypeScript type checking (tsc)
npm test             # Run tests (vitest)
npm run db:push      # Push schema changes to PostgreSQL (drizzle-kit)
npm start            # Run production server (dist/index.cjs)
```

## Verification Requirements

- ALWAYS run `npm run check` after code changes to catch type errors.
- ALWAYS run `npm test` after modifying game logic in `shared/gameEngine.ts` to catch regressions. Tests cover `determineTrickWinner`, `canPlayCard`, `calculateRoundScores`, `playCard`, `processBid`, `performPurgeAndDraw`, `dealCards`, `createDeck`, and `shuffleDeck`.
- ALWAYS run `npm run build` before marking work complete. A successful build only means it compiles — it does not mean existing features still work correctly.
- After modifying game logic in `shared/gameEngine.ts`, manually verify the affected flow in the browser. Compilation does not catch logic regressions.

## Plan Review Protocol

IMPORTANT: When presenting or receiving an implementation plan, always ask: **"What could go wrong with this approach?"** Force identification of risks before writing code. Specifically consider:
- Will this cause unnecessary re-renders or re-mount cycles?
- Does this interact correctly with framer-motion's animation lifecycle?
- Could state updates race with timeouts, WebSocket messages, or CPU turn scheduling?
- Does the change work in both single-player AND multiplayer modes?

If the answer to "what could go wrong?" is "nothing" — that's a red flag. Dig deeper.

## Architecture Overview

### Project Structure

- `client/` — React 18 frontend (Vite, Tailwind, shadcn/ui, Framer Motion)
- `server/` — Express backend with WebSocket (`ws`) for real-time multiplayer
- `shared/` — Game types, game engine, and database schema (imported by both client and server)
- `script/build.ts` — Two-stage build: Vite for client, esbuild for server

### Path Aliases

- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

### Game Engine (`shared/gameEngine.ts`)

Pure functions for all state transitions: `initializeGame`, `dealCards`, `processBid`, `playCard`, `determineTrickWinner`, `calculateRoundScores`, `performPurgeAndDraw`. Both client and server import the same engine. Game state is immutable — every function returns a new `GameState`.

### Game Phases

`setup` → `dealer-draw` → `dealing` → `bidding` → `trump-selection` → `purge-draw` → `discard-trump` → `playing` → `scoring` → `game-over`

### Single-Player vs Multiplayer

GameBoard.tsx handles both modes. In single-player, it calls game engine functions directly via `setGameState`. In multiplayer, it sends actions via `multiplayer.sendAction()` and receives state updates over WebSocket. **Any change to game flow must work in both modes.**

### WebSocket Server (`server/ws/`)

Split into focused modules:
- `state.ts` — Global maps (rooms, connections, timers)
- `roomManager.ts` — Room CRUD, player/CPU management
- `gameSync.ts` — Game state sync, action handling, CPU automation
- `spectatorManager.ts` — Spectator connections
- `chatManager.ts` — In-game chat
- `statsTracker.ts` — Game statistics

### Client State

- `GameBoard.tsx` is the main game component (~840 lines). It manages local game state, multiplayer sync, trick display timing, sound triggers, and modal visibility.
- `useMultiplayer.ts` — WebSocket connection, reconnection, and game state sync hook.
- `useCpuTurns.ts` — Schedules CPU moves with delays in single-player mode.
- `useSoundEffects.tsx` — Web Audio API synthesized sounds via React context. Sound types: `cardPlay`, `cardDeal`, `trickWon`, `bidMade`, `bidSet`, `victory`, `defeat`, `yourTurn`, `buttonClick`, `shuffle`, `catch5Slam`.

### Trick Display Timing

When a trick completes (4 cards), GameBoard uses `displayTrick` state to show the completed trick for 2.5 seconds before clearing it and advancing. The game engine increments `trickNumber` and clears `currentTrick` immediately when the 4th card is played — so by the time `displayTrick` renders, `gameState.trickNumber` has already advanced. Keep this timing gap in mind when adding features that depend on trick state.

### Styling

- Tailwind CSS with CSS custom properties for theming (light/dark)
- shadcn/ui (new-york style) for base components in `client/src/components/ui/`
- Game-specific CSS tokens: `--felt`, `--felt-glow`, `--gold`, `--team-blue`, `--team-red`
- Fonts: DM Sans (body), Outfit (display headings), Fira Code (mono)

### Database

PostgreSQL via Drizzle ORM. Schema in `shared/schema.ts`. Tables: `sessions`, `users` (Replit Auth), `userStats`, `gameRooms`, `roomPlayers`. No migrations directory — schema pushed directly via `drizzle-kit push`. Requires `DATABASE_URL` env var.

## Game-Specific Rules

- The trump Ace + trump 5 slam effect ("NOW THAT'S A PAHTNAH!") only triggers when both cards are the **trump suit** and played by **teammates** in the same trick.
- Card values and scoring logic live in `shared/gameTypes.ts` (`CARD_VALUES`) and `shared/gameEngine.ts` (`calculateRoundScores`). The 5 of trump is worth 5 points, the Ace of trump is worth 4 points.
- `trickNumber` starts at 1 and increments when a trick completes (4th card played).
