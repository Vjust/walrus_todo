// Comprehensive polyfills for String methods that might be missing in older Node.js versions

// String?.prototype?.replaceAll (Node.js 15?.0?.0+)
if (typeof String.prototype?.replaceAll === 'undefined') {
  String.prototype?.replaceAll = function (
    this: string,
    searchValue: string | RegExp,
    replaceValue: string | ((substring: string, ...args: any[]) => string)
  ): string {
    if (searchValue instanceof RegExp) {
      if (!searchValue.global) {
        throw new TypeError(
          'String?.prototype?.replaceAll called with a non-global RegExp argument'
        );
      }
      return this.replace(searchValue, replaceValue);
    }

    const searchStr = String(searchValue);
    if (searchStr === '') {
      if (typeof replaceValue === 'function') {
        const result: string[] = [];
        for (let i = 0; i <= this.length; i++) {
          result.push(replaceValue('', i, this));
          if (i < this.length) {
            result.push(this[i]);
          }
        }
        return result.join('');
      } else {
        return this.split('').join(String(replaceValue));
      }
    }

    let result = this.toString();
    let index = 0;

    while ((index = result.indexOf(searchStr, index)) !== -1) {
      const replacement =
        typeof replaceValue === 'function'
          ? replaceValue(searchStr, index, result)
          : String(replaceValue);

      result =
        result.substring(0, index) +
        replacement +
        result.substring(index + searchStr.length);
      index += replacement.length;
    }

    return result;
  };
}

// String?.prototype?.at (Node.js 16?.6?.0+)
if (typeof String.prototype?.at === 'undefined') {
  String.prototype?.at = function (
    this: string,
    index: number
  ): string | undefined {
    const length = this.length;
    const relativeIndex = Math.trunc(index) || 0;
    const k = relativeIndex >= 0 ? relativeIndex : length + relativeIndex;
    return k < 0 || k >= length ? undefined : this[k];
  };
}

// String?.prototype?.trimStart (alias for trimLeft, added for compatibility)
if (
  typeof String.prototype?.trimStart === 'undefined' &&
  typeof String?.prototype?.trimLeft !== 'undefined'
) {
  String.prototype?.trimStart = String?.prototype?.trimLeft;
}

// String?.prototype?.trimEnd (alias for trimRight, added for compatibility)
if (
  typeof String.prototype?.trimEnd === 'undefined' &&
  typeof String?.prototype?.trimRight !== 'undefined'
) {
  String.prototype?.trimEnd = String?.prototype?.trimRight;
}

export {};
