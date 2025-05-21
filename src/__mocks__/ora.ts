// Mock implementation for ora (ESM module that causes Jest issues)
export interface OraInstance {
  start(): OraInstance;
  stop(): OraInstance;
  succeed(text?: string): OraInstance;
  fail(text?: string): OraInstance;
  warn(text?: string): OraInstance;
  info(text?: string): OraInstance;
  clear(): OraInstance;
  text: string;
  color: string;
  spinner: any;
  prefixText?: string;
  indent?: number;
  discardStdin?: boolean;
  hideCursor?: boolean;
  stream?: NodeJS.WritableStream;
  isSpinning: boolean;
}

export interface OraOptions {
  text?: string;
  color?: string;
  spinner?: any;
  prefixText?: string;
  indent?: number;
  discardStdin?: boolean;
  hideCursor?: boolean;
  stream?: NodeJS.WritableStream;
}

class MockOraInstance implements OraInstance {
  text: string;
  color: string;
  spinner: any;
  prefixText?: string;
  indent?: number;
  discardStdin?: boolean;
  hideCursor?: boolean;
  stream?: NodeJS.WritableStream;
  isSpinning: boolean = false;

  constructor(options: OraOptions = {}) {
    this.text = options.text || '';
    this.color = options.color || 'cyan';
    this.spinner = options.spinner || { interval: 80, frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] };
    this.prefixText = options.prefixText;
    this.indent = options.indent;
    this.discardStdin = options.discardStdin;
    this.hideCursor = options.hideCursor;
    this.stream = options.stream;
  }

  start(): OraInstance {
    this.isSpinning = true;
    return this;
  }

  stop(): OraInstance {
    this.isSpinning = false;
    return this;
  }

  succeed(text?: string): OraInstance {
    this.isSpinning = false;
    if (text) this.text = text;
    return this;
  }

  fail(text?: string): OraInstance {
    this.isSpinning = false;
    if (text) this.text = text;
    return this;
  }

  warn(text?: string): OraInstance {
    this.isSpinning = false;
    if (text) this.text = text;
    return this;
  }

  info(text?: string): OraInstance {
    this.isSpinning = false;
    if (text) this.text = text;
    return this;
  }

  clear(): OraInstance {
    return this;
  }
}

const ora = (options?: string | OraOptions): OraInstance => {
  if (typeof options === 'string') {
    return new MockOraInstance({ text: options });
  }
  return new MockOraInstance(options);
};

// Export both as default and named export to handle different import styles
export default ora;
module.exports = ora;
module.exports.default = ora;