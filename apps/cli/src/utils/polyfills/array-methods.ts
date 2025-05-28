// Polyfills for Array methods that might be missing in older Node.js versions

// Array.prototype.at (Node.js 16.6.0+)
if (typeof Array.prototype.at === 'undefined') {
  Array.prototype.at = function<T>(this: T[], index: number): T | undefined {
    const length = this.length;
    const relativeIndex = Math.trunc(index) || 0;
    const k = relativeIndex >= 0 ? relativeIndex : length + relativeIndex;
    return (k < 0 || k >= length) ? undefined : this[k];
  };
}

// Array.prototype.findLast (Node.js 18.0.0+)
if (typeof Array.prototype.findLast === 'undefined') {
  Array.prototype.findLast = function<T>(
    this: T[],
    predicate: (value: T, index: number, obj: T[]) => boolean,
    thisArg?: any
  ): T | undefined {
    for (let i = this.length - 1; i >= 0; i--) {
      const value = this[i];
      if (predicate.call(thisArg, value, i, this)) {
        return value;
      }
    }
    return undefined;
  };
}

// Array.prototype.findLastIndex (Node.js 18.0.0+)
if (typeof Array.prototype.findLastIndex === 'undefined') {
  Array.prototype.findLastIndex = function<T>(
    this: T[],
    predicate: (value: T, index: number, obj: T[]) => boolean,
    thisArg?: any
  ): number {
    for (let i = this.length - 1; i >= 0; i--) {
      const value = this[i];
      if (predicate.call(thisArg, value, i, this)) {
        return i;
      }
    }
    return -1;
  };
}

// Array.prototype.toReversed (Node.js 20.0.0+) - Non-mutating reverse
if (typeof Array.prototype.toReversed === 'undefined') {
  Array.prototype.toReversed = function<T>(this: T[]): T[] {
    return [...this].reverse();
  };
}

// Array.prototype.toSorted (Node.js 20.0.0+) - Non-mutating sort
if (typeof Array.prototype.toSorted === 'undefined') {
  Array.prototype.toSorted = function<T>(
    this: T[],
    compareFn?: (a: T, b: T) => number
  ): T[] {
    return [...this].sort(compareFn);
  };
}

// Array.prototype.with (Node.js 20.0.0+) - Non-mutating element replacement
if (typeof Array.prototype.with === 'undefined') {
  Array.prototype.with = function<T>(this: T[], index: number, value: T): T[] {
    const length = this.length;
    const relativeIndex = Math.trunc(index) || 0;
    const actualIndex = relativeIndex >= 0 ? relativeIndex : length + relativeIndex;
    
    if (actualIndex < 0 || actualIndex >= length) {
      throw new RangeError('Invalid index');
    }
    
    const result = [...this];
    result[actualIndex] = value;
    return result;
  };
}

export {};