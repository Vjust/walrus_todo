# Walrus Todo - Oceanic Frontend Demo

This is a standalone, dependency-free HTML demo of the Walrus Todo frontend with an oceanic design theme.

## How to View the Demo

Simply open any of these HTML files in your web browser:

- **index.html** - Home page with feature overview
- **dashboard.html** - Todo management dashboard
- **nft-todos.html** - NFT todo collection with blockchain integration

You can navigate between pages using the links in the navigation bar.

## No Build Required

These HTML files work directly in any modern browser - no build process, dependencies, or server required!

## Features

This frontend demo showcases:

- Oceanic, dreamy design theme with wave elements
- Floating animations and interactive components
- Glass-morphism card style with backdrop blur
- Todo management interface
- Blockchain wallet integration simulation
- NFT todo visualization
- Mobile-responsive layout

## Design Elements

The UI uses an oceanic color palette:

- Deep ocean blues (#003366, #0077b6)
- Light teals and foams (#90e0ef, #caf0f8)
- Accent purples and corals (#7209b7, #ff7f50)

All pages include:
- Animated floating elements
- Frosted glass card components
- Wave-like decorative shapes
- Responsive design for all screen sizes

## Integration Points

In a full implementation, this frontend would connect to:
1. The Walrus Todo CLI backend services
2. Sui wallet browser extensions
3. Walrus decentralized storage
4. Blockchain operations for NFT todos

## Wallet Integration

To enable Sui wallet connections in the React/Next.js version:
1. Install dependencies: `npm install`.
2. Wrap your app with `<WalletProvider>` in `app/layout.js`.
3. Add `<ConnectButton />` in your header or desired component.
4. Import wallet styles in `styles/globals.css`: `@import "@suiet/wallet-kit/style.css"`.
## Commands

From the project root, you can use:

```bash
# Open the home page
pnpm run web

# Open the dashboard
pnpm run web:dashboard

# Open the NFT todos page
pnpm run web:nft
```