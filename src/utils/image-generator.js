"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultImagePath = getDefaultImagePath;
exports.generateTodoImageUrl = generateTodoImageUrl;
exports.generateTodoImageDataUrl = generateTodoImageDataUrl;
var path = require("path");
var DEFAULT_IMAGE_PATH = path.resolve(__dirname, '../../assets/todo_bottle.jpeg');
/**
 * Utility for generating NFT images for todos
 */
/**
 * Get the path to the default todo image
 * @returns Path to the default todo image
 */
function getDefaultImagePath() {
    return DEFAULT_IMAGE_PATH;
}
/**
 * Generate a URL for the NFT image
 * @param title Todo title
 * @param completed Whether the todo is completed
 * @returns URL for the NFT image
 */
function generateTodoImageUrl(title, completed) {
    // Base URL for a placeholder image service
    var baseUrl = 'https://placehold.co/600x400';
    // Generate a simple color based on the todo title
    var hash = title.split('').reduce(function (acc, char) { return acc + char.charCodeAt(0); }, 0);
    var hue = hash % 360;
    var saturation = 80;
    var lightness = completed ? 30 : 60;
    // Create background color
    var bgColor = "hsl(".concat(hue, ", ").concat(saturation, "%, ").concat(lightness, "%)");
    // Create text color
    var textColor = lightness > 50 ? '000000' : 'FFFFFF';
    // Status icon
    var statusEmoji = completed ? '✅' : '⏳';
    // Create display text (truncate if too long)
    var displayTitle = title.length > 20 ? "".concat(title.substring(0, 17), "...") : title;
    var displayText = "".concat(statusEmoji, " ").concat(displayTitle);
    // For more advanced options, we could use a real image generation service
    // But for simplicity, we'll use a placeholder with text
    return "".concat(baseUrl, "/").concat(bgColor.replace('#', ''), "/").concat(textColor, "?text=").concat(encodeURIComponent(displayText));
}
/**
 * Alternative: Generate a data URI for the NFT image
 * This is useful if you want to store the image directly on Walrus
 * @param title Todo title
 * @param completed Whether the todo is completed
 * @returns Data URI for the NFT image
 */
function generateTodoImageDataUrl(title, completed) {
    // Simple SVG generation - this creates a small, clean SVG image
    var truncatedTitle = title.length > 20 ? "".concat(title.substring(0, 17), "...") : title;
    var statusIcon = completed ? '✓' : '○';
    // Generate background color based on title
    var hash = title.split('').reduce(function (acc, char) { return acc + char.charCodeAt(0); }, 0);
    var hue = hash % 360;
    var saturation = 80;
    var lightness = completed ? 50 : 70;
    var svg = "\n    <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"300\" height=\"300\" viewBox=\"0 0 300 300\">\n      <rect width=\"300\" height=\"300\" fill=\"hsl(".concat(hue, ", ").concat(saturation, "%, ").concat(lightness, "%)\" rx=\"15\" />\n      <text x=\"150\" y=\"120\" font-family=\"Arial\" font-size=\"24\" text-anchor=\"middle\" fill=\"white\">").concat(truncatedTitle, "</text>\n      <text x=\"150\" y=\"180\" font-family=\"Arial\" font-size=\"72\" text-anchor=\"middle\" fill=\"white\">").concat(statusIcon, "</text>\n      <text x=\"150\" y=\"240\" font-family=\"Arial\" font-size=\"18\" text-anchor=\"middle\" fill=\"white\">Todo NFT</text>\n    </svg>\n  ");
    // Convert to base64 data URI
    var base64 = Buffer.from(svg).toString('base64');
    return "data:image/svg+xml;base64,".concat(base64);
}
