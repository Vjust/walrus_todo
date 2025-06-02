/**
 * Custom image loader for CDN integration
 * Handles image optimization and CDN URL generation
 */

export default function customImageLoader({ src, width, quality }) {
  const cdnUrl = process.env.NEXT_PUBLIC_IMAGE_CDN_URL || process.env.NEXT_PUBLIC_CDN_URL || '';
  
  // If no CDN URL, use default behavior
  if (!cdnUrl) {
    return src;
  }
  
  // Handle Walrus URLs specially
  if (src.includes('walrus.site') || src.includes('walrus.space')) {
    return src;
  }
  
  // Handle absolute URLs
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  
  // Build CDN URL with optimization parameters
  const params = [];
  
  if (width) {
    params.push(`w=${width}`);
  }
  
  if (quality) {
    params.push(`q=${quality || 75}`);
  }
  
  // Add format auto-detection
  params.push('f=auto');
  
  // Remove leading slash from src if present
  const cleanSrc = src.startsWith('/') ? src.slice(1) : src;
  
  // Build final URL
  const baseUrl = cdnUrl.endsWith('/') ? cdnUrl.slice(0, -1) : cdnUrl;
  const queryString = params.length > 0 ? `?${params.join('&')}` : '';
  
  return `${baseUrl}/${cleanSrc}${queryString}`;
}