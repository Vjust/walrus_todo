/**
 * Generates unique identifiers for application entities
 */

/**
 * Generate a unique ID using timestamp and random values
 * @returns {string} A unique identifier string
 */
export function generateId(): string {
  const timestamp = Date.now();
  const randomPart = Math.floor(Math.random() * 1000000);
  return `${timestamp}-${randomPart}`;
}

/**
 * Generate a deterministic ID based on input string
 * Useful for creating consistent IDs for the same content
 *
 * @param input String to generate ID from
 * @returns {string} A deterministic ID
 */
export function generateDeterministicId(input: string): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `${Math.abs(hash)}`;
}
