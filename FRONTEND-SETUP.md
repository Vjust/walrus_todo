# Walrus Todo Frontend Setup

This project includes an oceanic-themed frontend for the Walrus Todo application.

## Static HTML Demo (RECOMMENDED)

The simplest and most reliable way to view the frontend is to open the static HTML files directly:

```bash
# Open the frontend demo directly
pnpm run web

# Or navigate to the directory and open the files
cd frontend-demo
open index.html  # On macOS
# Or double-click the files in your file explorer
```

The static HTML demo includes:
- `index.html` - Home page with overview
- `dashboard.html` - Todo management dashboard 
- `nft-todos.html` - NFT todo collection view

These files don't require any build process or dependencies.

## Alternative: Next.js/React Version (Not Recommended)

There's also a React version with Next.js, but due to configuration complexities with the latest Next.js version, we recommend using the static HTML demo instead.

If you still want to try the React version:

```bash
# First, setup the frontend (install dependencies)
pnpm run frontend:setup

# Then start the development server
pnpm run frontend:dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

Note: If you encounter any errors with the React version, please use the static HTML demo instead.

## Features Showcased

Both versions showcase:

- Oceanic, dreamy design theme 
- Floating animations and wave elements
- Glassmorphism card components
- Todo management interface
- Blockchain wallet integration
- NFT todo visualization
- Mobile-responsive layout

## Integration with Backend

In a complete implementation, this frontend would integrate with:
1. Your existing Walrus Todo CLI backend  
2. Sui wallet browser extensions
3. Walrus decentralized storage
4. Blockchain operations for NFT todos

The current frontend demonstrates the UI/UX design only.

## Troubleshooting

If you encounter issues with the React version:
- Make sure you've run `pnpm run frontend:setup` first
- If Tailwind CSS errors occur, use the static HTML version instead
- Check for Node.js version compatibility (14+ required)

For any persistent issues, the static HTML demo is always available as a fallback.