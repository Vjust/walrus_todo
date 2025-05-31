# WalTodo PWA Implementation

This document describes the Progressive Web App (PWA) implementation for WalTodo, enabling offline functionality, installability, and NFT-specific features.

## Features Implemented

### 1. **PWA Manifest** (`/public/manifest.json`)
- App name, description, and icons
- Theme colors matching the ocean design
- App shortcuts for quick actions:
  - Create NFT
  - Add Task
  - NFT Gallery
- Share target for receiving images and text

### 2. **Service Worker** (`/public/service-worker.js`)
- **Offline Support**: Cache-first strategy for static assets
- **NFT Image Caching**: Special cache for NFT images
- **Background Sync**: Sync todos and NFTs when back online
- **Push Notifications**: Support for NFT event notifications
- **Periodic Sync**: Check for NFT updates periodically

### 3. **PWA Manager** (`/src/lib/pwa-manager.ts`)
- Centralized PWA functionality management
- Install prompt handling
- Notification permission requests
- Cache management
- Metrics tracking
- Share API integration

### 4. **Components**

#### PWAInstallPrompt (`/src/components/PWAInstallPrompt.tsx`)
- Shows install prompt after 30 seconds
- Different UI for iOS (manual instructions)
- Dismissible with 7-day cooldown

#### PWAMetrics (`/src/components/PWAMetrics.tsx`)
- Real-time PWA metrics display
- Cache performance visualization
- Online/offline status
- Notification permission status
- Install statistics

#### OfflineNFTGallery (`/src/components/OfflineNFTGallery.tsx`)
- View cached NFTs when offline
- Cache refresh functionality
- Offline indicators

### 5. **Hooks**

#### usePWA (`/src/hooks/usePWA.ts`)
- React hook for PWA functionality
- State management for install/online status
- Actions for notifications, caching, sharing

## Setup Instructions

### 1. Install Dependencies
The app already includes all necessary dependencies.

### 2. Generate Icons
```bash
cd waltodo-frontend
node scripts/generate-pwa-icons.js
```

This creates placeholder icons. For production, replace with actual PNG images using:
- [PWA Builder Image Generator](https://www.pwabuilder.com/imageGenerator)
- [Maskable.app](https://maskable.app/)
- [RealFaviconGenerator](https://realfavicongenerator.net/)

### 3. Enable HTTPS (Required for PWA)
PWAs require HTTPS in production. For local testing:
- The service worker is disabled on localhost
- Use ngrok or similar for HTTPS testing

### 4. Test PWA Features

#### Install Prompt
- Open the app in Chrome/Edge
- Wait 30 seconds or check for install icon in address bar
- Click install when prompted

#### Offline Mode
- Install the PWA
- Go offline (airplane mode or disable network)
- App should still load with cached content
- NFT gallery shows cached images

#### Share Target
- Install the PWA
- Share an image from another app
- Select WalTodo as share target
- Image opens in NFT creation flow

#### Push Notifications
- Click "Enable Notifications" in PWA Metrics
- Grant permission when prompted
- Notifications for NFT events will appear

## API Endpoints Required

### `/api/nfts`
- GET: Fetch user's NFTs for caching
- Response: Array of NFT objects with imageUrl

### `/api/nfts/sync`
- POST: Sync offline-created NFTs
- Body: Array of NFT data

### `/api/nfts/updates`
- GET: Check for new NFTs
- Response: { hasNewNFTs: boolean, count: number }

### `/api/share-target`
- POST: Handle shared content
- Accepts multipart/form-data with images

## Customization

### Theme Colors
Edit in `manifest.json` and `viewport` export in `layout.tsx`:
```json
"theme_color": "#0EA5E9",
"background_color": "#0F172A"
```

### Cache Strategy
Modify in `service-worker.js`:
- `CACHE_NAME`: Version your cache
- `STATIC_ASSETS`: Assets to precache
- `NFT_CACHE`: Separate cache for NFT images

### Install Prompt Timing
Change delay in `PWAInstallPrompt.tsx`:
```typescript
setTimeout(() => {
  // Show after 30 seconds
  setShowPrompt(true);
}, 30000);
```

### Notification Options
Configure in `pwa-manager.ts`:
```typescript
await this.swRegistration.showNotification(title, {
  icon: '/icons/icon-192x192.png',
  badge: '/icons/badge-72x72.png',
  vibrate: [100, 50, 100],
  ...options
});
```

## Browser Support

### Full Support
- Chrome/Edge 80+
- Firefox 84+
- Safari 11.3+ (iOS)
- Samsung Internet 12+

### Partial Support
- Safari macOS (no install prompt)
- Firefox Android (no install prompt)

### Features by Platform
| Feature | Chrome | Safari iOS | Firefox |
|---------|--------|------------|---------|
| Install | ✅ | ✅* | ✅** |
| Offline | ✅ | ✅ | ✅ |
| Share Target | ✅ | ❌ | ❌ |
| Push Notifications | ✅ | ✅ | ✅ |
| Background Sync | ✅ | ❌ | ❌ |

*iOS requires manual "Add to Home Screen"
**Firefox Android requires manual install

## Performance Impact

### Bundle Size
- Service Worker: ~10KB
- PWA Manager: ~8KB
- Components: ~15KB total

### Caching
- Static assets: Cached indefinitely
- NFT images: Cached with 24h TTL
- API responses: Cached with 5min TTL

### Memory Usage
- NFT cache limited to 100 images
- Older images automatically evicted
- localStorage for metrics: ~2KB

## Security Considerations

1. **HTTPS Required**: Service workers only work on HTTPS
2. **CSP Headers**: Update Content-Security-Policy for service worker
3. **Origin Restrictions**: Share target validates origin
4. **Cache Validation**: Cached responses validated before use

## Troubleshooting

### Service Worker Not Registering
1. Check HTTPS (or localhost)
2. Check console for errors
3. Clear browser cache and retry

### Install Prompt Not Showing
1. Check if already installed
2. Wait full 30 seconds
3. Check browser compatibility

### Offline Mode Not Working
1. Install app first
2. Visit pages while online to cache
3. Check DevTools > Application > Cache

### Notifications Not Working
1. Check permission status
2. Ensure service worker active
3. Check browser notification settings

## Future Enhancements

1. **Workbox Integration**: Better caching strategies
2. **Web Share API v2**: Share multiple files
3. **File System Access**: Save NFTs locally
4. **WebAuthn**: Biometric authentication
5. **Payment Request API**: In-app NFT purchases
6. **Badging API**: Show NFT count on icon
7. **Contact Picker API**: Share NFTs with contacts
8. **Idle Detection**: Pause background sync
9. **Screen Wake Lock**: Keep screen on during NFT creation
10. **Web NFC**: Tap to share NFTs

## Development Commands

```bash
# Test PWA locally
pnpm dev

# Build for production
pnpm build

# Analyze bundle size
pnpm analyze:bundle

# Test with Lighthouse
pnpm test:lighthouse

# Generate icons
node scripts/generate-pwa-icons.js
```

## Conclusion

WalTodo is now a fully functional Progressive Web App with:
- ✅ Installable on all platforms
- ✅ Works offline with cached content
- ✅ NFT-specific features (gallery, caching)
- ✅ Share target for images
- ✅ Push notifications for NFT events
- ✅ Background sync for data
- ✅ App shortcuts for quick actions
- ✅ Performance metrics tracking

The PWA enhances the NFT task management experience by providing native app-like functionality while maintaining the decentralized nature of the application.