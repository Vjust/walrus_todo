/**
 * ResponseParser - Handles parsing and normalizing responses from different AI providers
 *
 * This class provides utilities for parsing and validating AI responses,
 * handling different response formats from various providers, and
 * ensuring type safety for structured responses.
 */

import { Logger } from '../../utils/Logger';

// Define response object types
interface ResponseWithText {
  text: string;
}

interface ResponseWithContent {
  content: string;
}

interface ResponseWithAnswer {
  answer: string;
}

interface ResponseWithResult {
  result: string;
}

// Remove unused type that was causing the error
// type ResponseObject = ResponseWithText | ResponseWithContent | ResponseWithAnswer | ResponseWithResult;

const logger = new Logger('ResponseParser');

export class ResponseParser {
  /**
   * Parse a JSON string into a structured object
   * @param jsonString The JSON string to parse
   * @param defaultValue The default value to return if parsing fails
   * @returns The parsed object or default value
   */
  public static parseJson<T>(
    jsonStringOrObject: string | unknown,
    defaultValue: T
  ): T {
    try {
      // If it's already an object (not a string), return it directly
      if (typeof jsonStringOrObject !== 'string') {
        // If it's already the correct type, return it
        if (
          // Arrays
          (Array.isArray(defaultValue) && Array.isArray(jsonStringOrObject)) ||
          // Objects
          (typeof defaultValue === 'object' &&
            defaultValue !== null &&
            typeof jsonStringOrObject === 'object' &&
            jsonStringOrObject !== null &&
            !Array.isArray(jsonStringOrObject))
        ) {
          return jsonStringOrObject as T;
        }

        // String representation to help with debugging
        logger.info(
          'Received non-string, non-matching type:',
          { type: typeof jsonStringOrObject }
        );
        return defaultValue;
      }

      // Handle empty or whitespace-only strings
      if (!jsonStringOrObject || !jsonStringOrObject.trim()) {
        return defaultValue;
      }

      // Handle cases where the AI might wrap the JSON in markdown code blocks
      let processed = jsonStringOrObject.trim();

      // Remove markdown code blocks if present
      const codeBlockRegex = /^```(?:json)?\s*([\s\S]*?)```$/;
      const match = processed.match(codeBlockRegex);
      if (match && match[1]) {
        processed = match[1].trim();
      }

      const parsed: unknown = JSON.parse(processed);
      return parsed as T;
    } catch (_error) {
      logger.error('Error parsing JSON response:', _error);
      return defaultValue;
    }
  }

  /**
   * Validate that an object has the expected properties
   * @param obj The object to validate
   * @param requiredProps The required properties
   * @returns True if the object has all required properties
   */
  public static validateObjectStructure(
    obj: unknown,
    requiredProps: string[]
  ): boolean {
    if (!obj || typeof obj !== 'object' || obj === null) {
      return false;
    }

    return requiredProps.every(
      prop => prop in (obj as Record<string, unknown>)
    );
  }

  /**
   * Extract a JSON object from a text response that may contain other text
   * @param text The text that may contain JSON
   * @param defaultValue The default value to return if extraction fails
   * @returns The extracted JSON object or default value
   */
  public static extractJsonFromText<T>(text: string, defaultValue: T): T {
    try {
      // Try to find JSON-like content in the response
      const jsonRegex = /\{[\s\S]*?\}|\[[\s\S]*?\]/g;
      const matches = text.match(jsonRegex);

      if (matches && matches.length > 0) {
        // Try each match until we find valid JSON
        for (const match of matches) {
          try {
            const parsed: unknown = JSON.parse(match);
            return parsed as T;
          } catch (e) {
            // Continue to next match
          }
        }
      }

      // If no JSON found or none valid, return default
      return defaultValue;
    } catch (_error) {
      logger.error('Error extracting JSON from text:', _error);
      return defaultValue;
    }
  }

  /**
   * Normalize a response to ensure consistent structure across providers
   * @param response The raw response
   * @param expectedType The expected type descriptor
   * @returns The normalized response or null if normalization fails
   */
  public static normalizeResponse<T>(
    response: unknown,
    expectedType: string
  ): T | null {
    try {
      // Handle different response formats based on expected type
      switch (expectedType) {
        case 'string':
          return typeof response === 'string'
            ? (response as unknown as T)
            : (response && typeof response === 'object' && 'text' in response && typeof (response as ResponseWithText).text === 'string') ? (response as ResponseWithText).text :
                (response && typeof response === 'object' && 'content' in response && typeof (response as ResponseWithContent).content === 'string') ? (response as ResponseWithContent).content :
                (response && typeof response === 'object' && 'answer' in response && typeof (response as ResponseWithAnswer).answer === 'string') ? (response as ResponseWithAnswer).answer :
                (response && typeof response === 'object' && 'result' in response && typeof (response as ResponseWithResult).result === 'string') ? (response as ResponseWithResult).result :
                null;

        case 'array':
          if (Array.isArray(response)) {
            return response as unknown as T;
          } else if (typeof response === 'string') {
            return this.parseJson<T>(response, [] as unknown as T);
          }
          return null;

        case 'object':
          if (typeof response === 'object' && !Array.isArray(response)) {
            return response as T;
          } else if (typeof response === 'string') {
            return this.parseJson<T>(response, {} as T);
          }
          return null;

        default:
          return response as T;
      }
    } catch (_error) {
      logger.error('Error normalizing response:', _error);
      return null;
    }
  }

  /**
   * Verify response contains expected structure for a specific schema
   * @param response The response to validate
   * @param schema Schema definition with property types
   * @returns True if the response matches the schema
   */
  public static validateSchema(
    response: unknown,
    schema: Record<string, string>
  ): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }

    for (const [key, type] of Object.entries(schema)) {
      // Skip optional properties (marked with ?)
      if (key.endsWith('?') && !(key.slice(0, -1) in response)) {
        continue;
      }

      const responseRecord = response as Record<string, unknown>;
      const value = responseRecord[key];

      // Check if the value exists and matches the expected type
      if (value === undefined) {
        return false;
      }

      switch (type) {
        case 'string':
          if (typeof value !== 'string') return false;
          break;
        case 'number':
          if (typeof value !== 'number') return false;
          break;
        case 'boolean':
          if (typeof value !== 'boolean') return false;
          break;
        case 'array':
          if (!Array.isArray(value)) return false;
          break;
        case 'object':
          if (
            typeof value !== 'object' ||
            value === null ||
            Array.isArray(value)
          )
            return false;
          break;
        default:
          // For complex types (e.g., 'array:string'), we'd need more sophisticated validation
          break;
      }
    }

    return true;
  }
}
