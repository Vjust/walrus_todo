#!/usr/bin/env node

// Node.js compatibility test script
// Tests all polyfills to ensure they work correctly across Node.js versions

console.log('🔧 Testing Node.js polyfills...');

// Load polyfills first (using compiled version)
require('./dist/apps/cli/src/utils/polyfills/index.js');

let errorCount = 0;

function test(name, testFn) {
  try {
    testFn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    errorCount++;
  }
}

// Test String methods
test('String.prototype.replaceAll', () => {
  const result = 'hello world hello'.replaceAll('hello', 'hi');
  if (result !== 'hi world hi') throw new Error('replaceAll failed');
});

test('String.prototype.at', () => {
  const result = 'hello'.at(-1);
  if (result !== 'o') throw new Error('String at failed');
});

test('String.prototype.trimStart', () => {
  const result = '  hello  '.trimStart();
  if (result !== 'hello  ') throw new Error('trimStart failed');
});

test('String.prototype.trimEnd', () => {
  const result = '  hello  '.trimEnd();
  if (result !== '  hello') throw new Error('trimEnd failed');
});

// Test Array methods
test('Array.prototype.at', () => {
  const result = [1, 2, 3].at(-1);
  if (result !== 3) throw new Error('Array at failed');
});

test('Array.prototype.findLast', () => {
  const result = [1, 2, 3, 2].findLast(x => x === 2);
  if (result !== 2) throw new Error('findLast failed');
});

test('Array.prototype.findLastIndex', () => {
  const result = [1, 2, 3, 2].findLastIndex(x => x === 2);
  if (result !== 3) throw new Error('findLastIndex failed');
});

test('Array.prototype.toReversed', () => {
  const original = [1, 2, 3];
  const result = original.toReversed();
  if (JSON.stringify(result) !== '[3,2,1]' || JSON.stringify(original) !== '[1,2,3]') {
    throw new Error('toReversed failed');
  }
});

test('Array.prototype.toSorted', () => {
  const original = [3, 1, 2];
  const result = original.toSorted();
  if (JSON.stringify(result) !== '[1,2,3]' || JSON.stringify(original) !== '[3,1,2]') {
    throw new Error('toSorted failed');
  }
});

test('Array.prototype.with', () => {
  const original = [1, 2, 3];
  const result = original.with(1, 5);
  if (JSON.stringify(result) !== '[1,5,3]' || JSON.stringify(original) !== '[1,2,3]') {
    throw new Error('with failed');
  }
});

// Test global methods
test('Object.hasOwn', () => {
  const obj = { prop: 'value' };
  if (!Object.hasOwn(obj, 'prop')) throw new Error('Object.hasOwn failed');
  if (Object.hasOwn(obj, 'nonexistent')) throw new Error('Object.hasOwn failed for non-existent property');
});

test('structuredClone', () => {
  const original = { a: 1, b: { c: 2 } };
  const cloned = structuredClone(original);
  cloned.b.c = 3;
  if (original.b.c !== 2) throw new Error('structuredClone failed - not a deep clone');
  if (cloned.b.c !== 3) throw new Error('structuredClone failed - clone not modifiable');
});

test('AbortSignal.timeout', () => {
  const signal = AbortSignal.timeout(100);
  if (signal.aborted) throw new Error('AbortSignal.timeout should not be immediately aborted');
  // We can't easily test the timeout without making this async, but we can test it exists
});

test('AbortSignal.abort', () => {
  const signal = AbortSignal.abort('test reason');
  if (!signal.aborted) throw new Error('AbortSignal.abort should create an aborted signal');
});

test('AggregateError', () => {
  const errors = [new Error('error 1'), new Error('error 2')];
  const aggregateError = new AggregateError(errors, 'Multiple errors occurred');
  if (aggregateError.errors.length !== 2) throw new Error('AggregateError failed');
  if (aggregateError.message !== 'Multiple errors occurred') throw new Error('AggregateError message failed');
});

// Summary
console.log('');
if (errorCount === 0) {
  console.log('🎉 All polyfill tests passed!');
  console.log('✨ Node.js compatibility verified');
} else {
  console.error(`❌ ${errorCount} polyfill test(s) failed`);
  process.exit(1);
}