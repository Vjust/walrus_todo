/// <reference types="@testing-library/jest-dom" />
import { jest } from '@jest/globals';

// Add jest-dom matchers
require('@testing-library/jest-dom');

// Make jest available globally
(global as any).jest = jest;
(global as any).expect = expect;