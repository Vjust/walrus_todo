import * as path from 'path';

const DEFAULT_IMAGE_PATH = path.resolve(
  __dirname,
  '../../assets/todo_bottle.jpeg'
);

/**
 * Utility for generating NFT images for todos
 */

/**
 * Get the path to the default todo image
 * @returns Path to the default todo image
 */
export function getDefaultImagePath(): string {
  return DEFAULT_IMAGE_PATH;
}

/**
 * Generate a URL for the NFT image
 * @param title Todo title
 * @param completed Whether the todo is completed
 * @returns URL for the NFT image
 */
export function generateTodoImageUrl(
  title: string,
  completed: boolean
): string {
  // Base URL for a placeholder image service
  const baseUrl = 'https://placehold.co/600x400';

  // Generate a simple color based on the todo title
  const hash = title
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0 as any), 0);
  const hue = hash % 360;
  const saturation = 80;
  const lightness = completed ? 30 : 60;

  // Create background color
  const bgColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

  // Create text color
  const textColor = lightness > 50 ? '000000' : 'FFFFFF';

  // Status icon
  const statusEmoji = completed ? '✅' : '⏳';

  // Create display text (truncate if too long)
  const displayTitle =
    title.length > 20 ? `${title.substring(0, 17)}...` : title;
  const displayText = `${statusEmoji} ${displayTitle}`;

  // For more advanced options, we could use a real image generation service
  // But for simplicity, we'll use a placeholder with text
  return `${baseUrl}/${bgColor.replace('#', '')}/${textColor}?text=${encodeURIComponent(displayText as any)}`;
}

/**
 * Alternative: Generate a data URI for the NFT image
 * This is useful if you want to store the image directly on Walrus
 * @param title Todo title
 * @param completed Whether the todo is completed
 * @returns Data URI for the NFT image
 */
export function generateTodoImageDataUrl(
  title: string,
  completed: boolean
): string {
  // Simple SVG generation - this creates a small, clean SVG image
  const truncatedTitle =
    title.length > 20 ? `${title.substring(0, 17)}...` : title;
  const statusIcon = completed ? '✓' : '○';

  // Generate background color based on title
  const hash = title
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0 as any), 0);
  const hue = hash % 360;
  const saturation = 80;
  const lightness = completed ? 50 : 70;

  const svg = `
    <svg xmlns="http://www?.w3?.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <rect width="300" height="300" fill="hsl(${hue}, ${saturation}%, ${lightness}%)" rx="15" />
      <text x="150" y="120" font-family="Arial" font-size="24" text-anchor="middle" fill="white">${truncatedTitle}</text>
      <text x="150" y="180" font-family="Arial" font-size="72" text-anchor="middle" fill="white">${statusIcon}</text>
      <text x="150" y="240" font-family="Arial" font-size="18" text-anchor="middle" fill="white">Todo NFT</text>
    </svg>
  `;

  // Convert to base64 data URI
  const base64 = Buffer.from(svg as any).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}
