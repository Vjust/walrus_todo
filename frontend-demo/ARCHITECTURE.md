# Walrus Todo - Architecture Overview

The Walrus Todo application consists of multiple components working together to provide a seamless experience across CLI and web interfaces.

```
┌────────────────────────────────────────────────────────────┐
│                      User Interfaces                        │
├───────────────────┐                   ┌───────────────────┐
│    CLI Interface  │                   │   Web Interface   │
│  (OCLIF Commands) │                   │  (Oceanic Theme)  │
└─────────┬─────────┘                   └─────────┬─────────┘
          │                                       │
          │                                       │
┌─────────▼─────────┐                   ┌─────────▼─────────┐
│   Core Services   │◄──────────────────┤  Frontend Logic   │
└─────────┬─────────┘                   └───────────────────┘
          │
          │
┌─────────▼─────────┐     ┌───────────────────────────────┐
│  Storage Manager  │◄────┤  AI-Powered Task Suggestions  │
└─────────┬─────────┘     └───────────────────────────────┘
          │
          │
┌─────────▼─────────────────────────────┐
│           Storage Options              │
├───────────────────┐ ┌─────────────────┐
│    Local JSON     │ │   Blockchain    │
│      Files        │ │      NFTs       │
└───────────────────┘ └─────────┬───────┘
                                │
                      ┌─────────▼───────┐
                      │ Walrus Storage  │
                      │     (Blobs)     │
                      └─────────────────┘
```

## Components

### User Interfaces

1. **CLI Interface (Node.js)**
   - Built with OCLIF framework
   - Commands for add, list, complete, etc.
   - Provides terminal-based interaction

2. **Web Interface (HTML/CSS/JS)**
   - Oceanic design theme
   - Responsive layout
   - Interactive todo management
   - NFT visualization

### Core Logic

1. **Core Services**
   - Todo management logic
   - Configuration management
   - User authentication
   - Permission control

2. **AI-Powered Features**
   - Task suggestions
   - Priority recommendations
   - Tag categorization
   - Todo summarization

### Storage System

1. **Storage Manager**
   - Unified storage API
   - Storage optimization
   - Hybrid storage model
   - Transaction handling

2. **Storage Options**
   - Local JSON files (for quick access)
   - Blockchain NFTs (for ownership)
   - Walrus decentralized storage (for content)

## Data Flow

1. User creates a todo via CLI or web interface
2. Core services process the request and validate input
3. Todo is stored in local JSON files for immediate access
4. Optional: Todo is stored on blockchain as NFT with Walrus storage reference
5. Optional: AI services enhance todos with suggestions, priorities, etc.
6. Todo can be retrieved, updated, or completed from any interface

## Integration Points

The web frontend integrates with the backend through several connection points:

1. **Todo Management**
   - Creating, reading, updating, deleting todos
   - Filtering and organizing by list

2. **Blockchain Integration**
   - Wallet connection for Sui blockchain
   - NFT todo creation and transfer
   - Transaction verification

3. **AI Features**
   - Smart suggestions for related tasks
   - Priority and tag recommendations
   - Todo summarization

## Technologies

- **Backend**: Node.js, TypeScript, OCLIF
- **Frontend**: HTML, CSS, JavaScript (with optional React/Next.js)
- **Blockchain**: Sui, Move language
- **Storage**: Walrus decentralized storage
- **AI**: XAI (Grok), OpenAI, Anthropic APIs