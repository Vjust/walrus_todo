"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
// Configure Jest timeout
globals_1.jest.setTimeout(10000);
// Reset all mocks before each test
beforeEach(() => {
    globals_1.jest.clearAllMocks();
});
