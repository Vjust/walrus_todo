// Script to generate placeholder PWA icons
const fs = require('fs');
const path = require('path');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, '..', 'public', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// SVG template for icons
const iconSvg = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#0EA5E9"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.3}" fill="#ffffff" opacity="0.2"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial, sans-serif" font-size="${size * 0.3}px" font-weight="bold" fill="#ffffff">W</text>
</svg>`;

// Shortcut icons SVG
const shortcutSvgs = {
  'shortcut-nft': `<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
    <rect width="96" height="96" fill="#6366F1"/>
    <path d="M30 40 L48 25 L66 40 L66 65 L48 80 L30 65 Z" fill="#ffffff" opacity="0.9"/>
    <text x="50%" y="55%" text-anchor="middle" font-family="Arial" font-size="24px" font-weight="bold" fill="#6366F1">NFT</text>
  </svg>`,
  'shortcut-task': `<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
    <rect width="96" height="96" fill="#10B981"/>
    <rect x="25" y="30" width="46" height="4" rx="2" fill="#ffffff"/>
    <rect x="25" y="46" width="46" height="4" rx="2" fill="#ffffff"/>
    <rect x="25" y="62" width="30" height="4" rx="2" fill="#ffffff"/>
  </svg>`,
  'shortcut-gallery': `<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
    <rect width="96" height="96" fill="#F59E0B"/>
    <rect x="20" y="25" width="25" height="25" rx="3" fill="#ffffff" opacity="0.9"/>
    <rect x="51" y="25" width="25" height="25" rx="3" fill="#ffffff" opacity="0.9"/>
    <rect x="20" y="56" width="25" height="25" rx="3" fill="#ffffff" opacity="0.9"/>
    <rect x="51" y="56" width="25" height="25" rx="3" fill="#ffffff" opacity="0.9"/>
  </svg>`,
};

// Icon sizes to generate
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Generate icon placeholders
console.log('Generating PWA icon placeholders...');

iconSizes.forEach(size => {
  const filename = path.join(iconsDir, `icon-${size}x${size}.png`);
  // For now, we'll create SVG files with .png extension as placeholders
  fs.writeFileSync(filename, iconSvg(size));
  console.log(`Created: ${filename}`);
});

// Generate shortcut icons
Object.entries(shortcutSvgs).forEach(([name, svg]) => {
  const filename = path.join(iconsDir, `${name}.png`);
  fs.writeFileSync(filename, svg);
  console.log(`Created: ${filename}`);
});

// Generate badge icon
const badgeSvg = `<svg width="72" height="72" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
  <circle cx="36" cy="36" r="36" fill="#EF4444"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="40px" font-weight="bold" fill="#ffffff">!</text>
</svg>`;
fs.writeFileSync(path.join(iconsDir, 'badge-72x72.png'), badgeSvg);

// Generate view and close icons
const viewIconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 5C7 5 2.73 8.11 1 12.5C2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="#0EA5E9"/>
</svg>`;
fs.writeFileSync(path.join(iconsDir, 'view-icon.png'), viewIconSvg);

const closeIconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="#64748B"/>
</svg>`;
fs.writeFileSync(path.join(iconsDir, 'close-icon.png'), closeIconSvg);

// Generate placeholder screenshots
const screenshotSvg = (width, height, title) => `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#0F172A"/>
  <rect x="0" y="0" width="${width}" height="60" fill="#1E293B"/>
  <text x="20" y="40" font-family="Arial" font-size="24px" font-weight="bold" fill="#0EA5E9">WalTodo</text>
  <text x="${width/2}" y="${height/2}" text-anchor="middle" font-family="Arial" font-size="32px" fill="#64748B">${title}</text>
</svg>`;

const screenshots = [
  { name: 'desktop-home.png', width: 1920, height: 1080, title: 'Desktop Dashboard' },
  { name: 'mobile-home.png', width: 750, height: 1334, title: 'Mobile Dashboard' },
  { name: 'nft-gallery.png', width: 1920, height: 1080, title: 'NFT Gallery' },
];

screenshots.forEach(({ name, width, height, title }) => {
  const filename = path.join(screenshotsDir, name);
  fs.writeFileSync(filename, screenshotSvg(width, height, title));
  console.log(`Created: ${filename}`);
});

// Generate NFT placeholder
const nftPlaceholderSvg = `<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="400" fill="#1E293B"/>
  <rect x="50" y="50" width="300" height="300" rx="20" fill="#334155" stroke="#475569" stroke-width="2"/>
  <text x="200" y="200" text-anchor="middle" font-family="Arial" font-size="24px" fill="#64748B">NFT Placeholder</text>
</svg>`;
fs.writeFileSync(path.join(__dirname, '..', 'public', 'images', 'nft-placeholder.png'), nftPlaceholderSvg);

console.log('\nPWA assets generation complete!');
console.log('\nNote: These are SVG placeholders. For production, replace with actual PNG images.');
console.log('You can use tools like:');
console.log('- https://www.pwabuilder.com/imageGenerator');
console.log('- https://maskable.app/');
console.log('- https://realfavicongenerator.net/');