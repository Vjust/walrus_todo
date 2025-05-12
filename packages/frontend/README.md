# Walrus Todo Web Frontend

This is the web frontend for the Walrus Todo application, featuring an oceanic, dreamy design theme and integration with the Sui blockchain and Walrus decentralized storage.

## Overview

The frontend is built using:
- **Next.js** - React framework for server-side rendering and static site generation
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Sui Blockchain** - Integration with the Sui blockchain for NFT todos
- **Walrus Storage** - Decentralized storage for todo data

## Features

- Intuitive, responsive UI with an oceanic design theme
- Wallet integration for blockchain transactions
- Web3 functionality for NFT todo management
- AI-powered todo suggestions and management
- Secure credential handling
- Blockchain verification of AI operations

## Development

### Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run the development server:
   ```bash
   pnpm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Building for Production

```bash
pnpm run build
pnpm run start
```

## Project Structure

- `src/app` - Next.js App Router pages
- `src/components` - React components
- `src/lib` - Utility functions and services
- `public` - Static assets

## Integration with Walrus Todo CLI

This frontend interfaces with the Walrus Todo CLI backend to provide a complete todo management experience across different platforms. The CLI handles backend operations while the web interface provides a user-friendly way to interact with your todos.

## Connecting to Blockchain

The frontend includes integration with the Sui blockchain through wallet connectors, allowing users to:

1. Connect their Sui wallet
2. View and manage their NFT todos
3. Store new todos on the blockchain
4. Transfer ownership of todos

## Design System

The UI features an oceanic, dreamy design theme with:

- Ocean-inspired color palette (deep blues, teals, foam whites)
- Wave animations and floating elements
- Frosted glass card components
- Responsive, mobile-friendly layout
- Smooth transitions and animations