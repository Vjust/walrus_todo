"use strict";
/**
 * Generates unique identifiers for application entities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.generateDeterministicId = generateDeterministicId;
/**
 * Generate a unique ID using timestamp and random values
 * @returns {string} A unique identifier string
 */
function generateId() {
    var timestamp = Date.now();
    var randomPart = Math.floor(Math.random() * 1000000);
    return "".concat(timestamp, "-").concat(randomPart);
}
/**
 * Generate a deterministic ID based on input string
 * Useful for creating consistent IDs for the same content
 *
 * @param input String to generate ID from
 * @returns {string} A deterministic ID
 */
function generateDeterministicId(input) {
    // Simple hash function
    var hash = 0;
    for (var i = 0; i < input.length; i++) {
        var char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return "".concat(Math.abs(hash));
}
