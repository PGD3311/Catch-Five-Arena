# Catch 5 Card Game

## Overview

A browser-based implementation of Catch 5 (also known as Pitch or Setback), a trick-taking card game for 4 players. The game features a human player competing against 3 CPU opponents. Players bid on tricks, select trump suits, and play cards to capture valuable trump cards with the goal of reaching 21 points first.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Query for server state, local useState/useCallback for game state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming (light/dark mode support)

### Game Engine Design
- Client-side game logic in `client/src/lib/gameEngine.ts`
- Pure functions for game state transitions (initialize, deal, bid, play)
- Game state managed in React component with `useState`
- CPU AI logic for bidding and card selection built into game engine

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript executed via tsx
- **API Pattern**: RESTful routes prefixed with `/api`
- **Storage Interface**: Abstracted storage layer (`IStorage` interface) with in-memory implementation for development

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` with Zod validation via drizzle-zod
- **Current Tables**: Users table with id, username, password
- **Migration**: Drizzle Kit for schema push (`db:push` script)

### Shared Code
- `shared/` directory contains code used by both client and server
- `gameTypes.ts`: Card game type definitions (Card, Player, GameState, suits, ranks)
- `schema.ts`: Database schema and Zod types

### Build System
- Development: Vite dev server with HMR for frontend, tsx for backend
- Production: Vite builds client to `dist/public`, esbuild bundles server to `dist/index.cjs`
- Path aliases: `@/` for client source, `@shared/` for shared code

## External Dependencies

### UI Framework
- Radix UI primitives for accessible components
- Tailwind CSS for utility-first styling
- Lucide React for icons
- class-variance-authority for component variants

### Data & State
- TanStack React Query for async state management
- Drizzle ORM for database operations
- Zod for runtime validation

### Database
- PostgreSQL (via `DATABASE_URL` environment variable)
- connect-pg-simple for session storage capability

### Development Tools
- Replit-specific Vite plugins for development experience
- TypeScript with strict mode enabled