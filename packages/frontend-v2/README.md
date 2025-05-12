# Walrus Todo Web3 Frontend

A modern, oceanic-themed Web3 frontend for the Walrus Todo application built with Next.js and Tailwind CSS.

## Features

- Dreamy oceanic design with glass-morphism cards
- Responsive layout for all device sizes
- Integration with Sui blockchain for NFT todos
- Wallet connection for blockchain transactions
- Animated UI elements with wave and floating effects
- Resilient local storage with fallbacks for restricted environments

## Getting Started

First, install dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Design System

This frontend uses a custom oceanic theme with:

- Ocean-inspired color palette (deep blues, teals, light foam colors)
- Glass-morphism cards with backdrop blur
- Subtle animations including floating elements and waves
- Responsive components optimized for all device sizes
- System font stack for optimal performance and availability

### Color Palette

- `ocean-deep`: #003366 - Deep blue for primary elements and dark backgrounds
- `ocean-medium`: #0077b6 - Medium blue for buttons and interactive elements
- `ocean-light`: #90e0ef - Light blue for hover states and accents
- `ocean-foam`: #caf0f8 - Very light blue for backgrounds and subtle elements
- `dream-purple`: #7209b7 - Purple for special elements and NFT indicators
- `dream-violet`: #9d4edd - Light purple for accents
- `dream-teal`: #48bfe3 - Teal for highlights and gradients
- `coral`: #ff7f50 - Accent color for attention-grabbing elements
- `sand`: #f5e1c0 - Neutral warm color for contrast

## Pages

### Home (/)
- Hero section with animated logo
- Feature highlights with glass-morphism cards
- Wallet connection button and simulation

### Dashboard (/dashboard)
- Todo list management interface
- Create new todos with priority, tags, due date
- Toggle todo completion
- List selection sidebar

### Blockchain (/blockchain)
- View NFT todos stored on the blockchain
- Display object IDs and transaction information
- Link to blockchain explorer

## Components

- `Navbar` - Navigation and wallet connection
- `TodoList` - Display and manage todo items
- `CreateTodoForm` - Form for creating new todos

## Integration with Backend

This frontend integrates with the Walrus Todo CLI backend for:

- Todo storage on the blockchain
- NFT representation of todos
- Wallet connectivity for Sui blockchain
- Data synchronization between local and blockchain storage

## Storage System

The frontend implements a robust storage system with:

- In-memory state management for core functionality
- Conditional localStorage persistence when available
- Graceful fallbacks for environments where storage access is restricted
- Storage availability detection and error handling

## Project Structure

- `src/app` - Next.js App Router pages
- `src/components` - Reusable React components
- `src/styles` - CSS and Tailwind configuration
- `src/lib` - Utility functions and blockchain integration
  - `src/lib/sui-client.ts` - Blockchain interaction simulation
  - `src/lib/todo-service.ts` - Todo data management
- `public` - Static assets including images

## Browser Compatibility

The application is designed to work in various environments:

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers with responsive design
- Environments with restricted localStorage access
- Server-side rendering compatible components

## Production Deployment

Build the application for production:

```bash
pnpm build
```

Then start the production server:

```bash
pnpm start
```

## Parent Project Integration

This frontend is part of the Walrus Todo monorepo and can be run from the root directory with:

```bash
# Install dependencies
pnpm run nextjs:install

# Run development server
pnpm run nextjs

# Build for production
pnpm run nextjs:build
```