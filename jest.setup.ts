/// <reference types="@testing-library/jest-dom" />
import { jest, expect, describe, it, test, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Add jest-dom matchers
require('@testing-library/jest-dom');

// Make Jest globals available 
(global as any).jest = jest;
(global as any).expect = expect;
(global as any).describe = describe;
(global as any).it = it;
(global as any).test = test;
(global as any).beforeAll = beforeAll;
(global as any).afterAll = afterAll;
(global as any).beforeEach = beforeEach;
(global as any).afterEach = afterEach;