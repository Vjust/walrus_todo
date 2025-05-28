declare module 'fancy-test' {
  interface Context {
    stdout: string;
    stderr: string;
  }

  interface Test {
    catch(fn: (error: Error) => void): Test;
    stdout(): Test;
    stderr(): Test;
    command(args: string[]): Test;
    it(message: string, fn?: (ctx: Context) => void): Test;
  }

  const test: Test;
}

declare module '@oclif/test' {
  export { test } from 'fancy-test';
  export { expect } from '@jest/globals';
}
