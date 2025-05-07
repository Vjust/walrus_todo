"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_ROOT = void 0;
exports.getAssetPath = getAssetPath;
exports.getProjectPath = getProjectPath;
var path = require("path");
var fs = require("fs");
// Find project root by looking for package.json
function findProjectRoot(startPath) {
    var currentPath = startPath;
    while (currentPath !== '/') {
        if (fs.existsSync(path.join(currentPath, 'package.json'))) {
            return currentPath;
        }
        currentPath = path.dirname(currentPath);
    }
    throw new Error('Could not find project root (no package.json found)');
}
// Get the project root directory
exports.PROJECT_ROOT = findProjectRoot(__dirname);
/**
 * Get the absolute path to a file in the assets directory
 * @param assetPath The relative path within the assets directory
 * @returns The absolute path to the asset
 */
function getAssetPath(assetPath) {
    var assetDir = path.join(exports.PROJECT_ROOT, 'assets');
    var fullPath = path.join(assetDir, assetPath);
    // Verify the path exists
    if (!fs.existsSync(fullPath)) {
        throw new Error("Asset not found: ".concat(fullPath));
    }
    return fullPath;
}
/**
 * Get the absolute path to a directory in the project
 * @param dir The directory name relative to project root
 * @returns The absolute path to the directory
 */
function getProjectPath(dir) {
    return path.join(exports.PROJECT_ROOT, dir);
}
