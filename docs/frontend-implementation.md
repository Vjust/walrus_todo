# Frontend Implementation Guide

Date: May 11, 2025

This document outlines the implementation details of the Walrus Todo Web3 frontend application.

## Overview

The Walrus Todo frontend is a Next.js-based web application that provides a user-friendly interface for interacting with the CLI-based blockchain todo application. It features an oceanic, dreamy design theme with modern UI components.

## Architecture

The frontend follows a standard Next.js architecture with the App Router pattern:

```
frontend-v2/
├── public/             # Static assets (images, etc.)
├── src/
│   ├── app/            # Next.js App Router pages
│   │   ├── dashboard/  # Dashboard page
│   │   ├── layout.tsx  # Root layout
│   │   └── page.tsx    # Home page
│   ├── components/     # Reusable React components
│   ├── lib/            # Utility functions and services
│   ├── styles/         # Global styles and Tailwind configuration
│   └── utils/          # Helper functions
├── next.config.js      # Next.js configuration
├── package.json        # Package dependencies
├── postcss.config.js   # PostCSS configuration
└── tailwind.config.js  # Tailwind CSS configuration
```

## Design System

The frontend implements a custom oceanic design system with the following key elements:

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

### Components

The design system includes custom Tailwind component classes:

- `ocean-card`: Glass-morphism cards with backdrop blur
- `wave-animation`: Elements with subtle wave animation
- `ocean-button`: Styled buttons with hover effects
- `ocean-input`: Form inputs with oceanic styling
- `floating-element`: Elements with floating animation

### Animations

- `wave`: 8-second wave animation for fluid elements
- `float`: 6-second floating animation for card elements

## Integration with Backend

The frontend integrates with the Walrus Todo CLI backend through several mechanisms:

1. **Local Data Synchronization**: Reading and writing todo data from local storage
2. **Blockchain Connectivity**: Interacting with Sui blockchain for NFT todos
3. **AI Features**: Leveraging the AI capabilities of the CLI for suggestions

## Key Components

### Navbar

Navigation component that handles wallet connection and provides links to different sections of the application.

### TodoList

Displays todos with completion status, priority indicators, and blockchain storage status.

### CreateTodoForm

Form for creating new todos with options for title, description, priority, tags, and due date. 

## Getting Started

To run the frontend:

```bash
# Install dependencies
pnpm run nextjs:install

# Start development server
pnpm run nextjs

# Build for production
pnpm run nextjs:build

# Start production server
pnpm run nextjs:start
```

## Implementation Considerations

1. **Responsive Design**: The UI is designed to work on all device sizes
2. **Wallet Integration**: Connects to Sui wallets for blockchain operations
3. **Blockchain Storage**: Shows indicators for todos stored on-chain
4. **Performance Optimization**: Uses Next.js features for optimal loading
5. **Accessibility**: Implements accessible UI patterns

## Resilient Storage Implementation

The frontend implements a robust storage system with several layers of resilience:

### Storage Availability Detection

We use a storage availability detection pattern to safely check if localStorage is available:

```typescript
const isStorageAvailable = () => {
  if (typeof window === 'undefined') return false;

  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};
```

### In-Memory Fallbacks

When localStorage isn't available, the application falls back to in-memory storage:

```typescript
// In-memory storage instead of localStorage to avoid access issues
let connected = false;
let address = '';
let todoLists = { /* default data */ };
```

### Safe Storage Operations

All storage operations are wrapped in safety checks:

```typescript
function saveTodoLists(): void {
  if (typeof window !== 'undefined' && isStorageAvailable()) {
    try {
      localStorage.setItem('walrusTodoLists', JSON.stringify(todoLists));
    } catch (e) {
      console.warn('Failed to save todo lists to storage:', e);
    }
  }
}
```

### Environment-Aware Code

Server-side rendering compatibility with environment checks:

```typescript
// Only run in browser environment
if (typeof window !== 'undefined') {
  loadBlockchainTodos();
}
```

### Progressive Enhancement

The application follows a progressive enhancement philosophy:
1. Core functionality works without localStorage
2. Storage persistence is added when available
3. UI doesn't depend on storage functionality
4. Error states are handled gracefully

## Error Resolution

During development, we encountered and resolved several issues:

1. **Google Fonts Connection Issues**
   - Switched from Google Fonts to system fonts
   - Modified Tailwind configuration with a robust font stack
   - Removed font loader from Next.js to prevent network errors

2. **Storage Access Errors**
   - Added environment detection (`typeof window !== 'undefined'`)
   - Implemented storage availability checking
   - Added try/catch blocks for all storage operations
   - Created in-memory fallbacks

3. **Missing Routes**
   - Added proper blockchain page for NFT todos
   - Ensured all navigation links point to valid routes

## Future Enhancements

1. **Real-time Sync**: Add WebSocket or polling to keep CLI and frontend in sync
2. **Advanced Filtering**: Implement more sophisticated todo filtering options
3. **Sharing Features**: Enhance NFT todo sharing capabilities
4. **Dark Mode Toggle**: Add user-controlled theme switching
5. **AI Integration UI**: Expand the UI for AI-powered todo features
6. **Offline Support**: Add service workers for offline functionality
7. **Progressive Web App**: Convert to a full PWA with installable capabilities