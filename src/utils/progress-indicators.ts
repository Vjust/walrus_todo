import * as chalk from 'chalk';
import { ICONS } from '../base-command';
import ora from 'ora';
import * as cliProgress from 'cli-progress';

// Define types
type Ora = ReturnType<typeof ora>;

// Fallback for testing environments if imports fail
if (!ora) {
  console.warn('ora import failed, using mock implementation');
  // @ts-expect-error - Mock ora for testing when import fails
  ora = () => ({
    start: () => ({ stop: () => {}, succeed: () => {}, fail: () => {} }),
    stop: () => {},
    succeed: () => {},
    fail: () => {}
  });
}

if (!cliProgress) {
  console.warn('cli-progress import failed, using mock implementation');
  // @ts-expect-error - Mock cli-progress for testing when import fails
  cliProgress = {
    SingleBar: class MockSingleBar {
      start() { return this; }
      update() { return this; }
      stop() { return this; }
    },
    MultiBar: class MockMultiBar {
      create() { return new cliProgress.SingleBar({}); }
      remove() {}
      stop() {}
    }
  };
}


/**
 * Configuration for spinner animation styles
 */
export const SPINNER_STYLES = {
  dots: {
    interval: 80,
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  },
  dots12: {
    interval: 80,
    frames: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷']
  },
  line: {
    interval: 130,
    frames: ['-', '\\', '|', '/']
  },
  star: {
    interval: 70,
    frames: ['✶', '✸', '✹', '✺', '✹', '✸']
  },
  moon: {
    interval: 80,
    frames: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']
  },
  walrus: {
    interval: 300,
    frames: ['🦭', '🦭 ', '🦭  ', '🦭   ', '🦭    ', '🦭   ', '🦭  ', '🦭 ']
  },
  sparkle: {
    interval: 100,
    frames: ['✨', '💫', '⭐', '🌟', '⭐', '💫']
  },
  bounce: {
    interval: 120,
    frames: ['▐⠂       ▌', '▐⠈       ▌', '▐ ⠂      ▌', '▐ ⠠      ▌', '▐  ⡀     ▌', '▐  ⠠     ▌', '▐   ⠂    ▌', '▐   ⠈    ▌', '▐    ⠂   ▌', '▐    ⠠   ▌', '▐     ⡀  ▌', '▐     ⠠  ▌', '▐      ⠂ ▌', '▐      ⠈ ▌', '▐       ⠂▌', '▐       ⠠▌', '▐       ⡀▌', '▐      ⠠ ▌', '▐      ⠂ ▌', '▐     ⠈  ▌', '▐     ⠂  ▌', '▐    ⠠   ▌', '▐    ⡀   ▌', '▐   ⠠    ▌', '▐   ⠂    ▌', '▐  ⠈     ▌', '▐  ⠂     ▌', '▐ ⠠      ▌', '▐ ⡀      ▌', '▐⠠       ▌']
  }
} as const;

/**
 * Spinner configuration options
 */
export interface SpinnerOptions {
  text?: string;
  color?: string;
  style?: keyof typeof SPINNER_STYLES;
  prefixText?: string;
  failText?: string;
  succeedText?: string;
  warnText?: string;
  indent?: number;
  discardStdin?: boolean;
  hideCursor?: boolean;
  stream?: NodeJS.WritableStream;
}

/**
 * Progress bar configuration options
 */
export interface ProgressBarOptions {
  format?: string;
  barCompleteChar?: string;
  barIncompleteChar?: string;
  barsize?: number;
  clearOnComplete?: boolean;
  stopOnComplete?: boolean;
  hideCursor?: boolean;
  linewrap?: boolean;
  fps?: number;
  etaBuffer?: number;
  progressCharacter?: string;
  autopadding?: boolean;
  autopaddingChar?: string;
  formatBar?: (progress: number, options: ProgressBarOptions) => string;
  formatValue?: (value: number, options: ProgressBarOptions, type: string) => string;
  formatTime?: (time: number, options: ProgressBarOptions, roundToMultipleOf?: number) => string;
  barGlue?: string;
  stream?: NodeJS.WritableStream;
  align?: 'left' | 'center' | 'right';
  gracefulExit?: boolean;
}

/**
 * Enhanced spinner manager with multiple styles and features
 */
export class SpinnerManager {
  private spinner: Ora;
  private options: SpinnerOptions;
  private nestedSpinners: SpinnerManager[] = [];
  private parent?: SpinnerManager;

  constructor(options: SpinnerOptions = {}) {
    this.options = {
      style: 'dots',
      color: 'cyan',
      ...options
    };

    const spinnerStyle = SPINNER_STYLES[this.options.style || 'dots'];
    
    this.spinner = ora({
      text: this.options.text,
      color: this.options.color as 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray',
      spinner: spinnerStyle,
      prefixText: this.options.prefixText,
      indent: this.options.indent,
      discardStdin: this.options.discardStdin,
      hideCursor: this.options.hideCursor,
      stream: this.options.stream,
    });
  }

  /**
   * Start the spinner
   */
  start(text?: string): this {
    if (text) {
      this.spinner.text = text;
    }
    this.spinner.start();
    return this;
  }

  /**
   * Stop the spinner
   */
  stop(): this {
    this.spinner.stop();
    // Stop all nested spinners
    this.nestedSpinners.forEach(nested => nested.stop());
    return this;
  }

  /**
   * Mark spinner as succeeded
   */
  succeed(text?: string): this {
    const successText = text || this.options.succeedText || this.spinner.text;
    this.spinner.succeed(`${ICONS.SUCCESS} ${successText}`);
    return this;
  }

  /**
   * Mark spinner as failed
   */
  fail(text?: string): this {
    const failText = text || this.options.failText || this.spinner.text;
    this.spinner.fail(`${ICONS.ERROR} ${failText}`);
    return this;
  }

  /**
   * Mark spinner as warning
   */
  warn(text?: string): this {
    const warnText = text || this.options.warnText || this.spinner.text;
    this.spinner.warn(`${ICONS.WARNING} ${warnText}`);
    return this;
  }

  /**
   * Mark spinner as info
   */
  info(text?: string): this {
    this.spinner.info(`${ICONS.INFO} ${text || this.spinner.text}`);
    return this;
  }

  /**
   * Update spinner text
   */
  text(text: string): this {
    this.spinner.text = text;
    return this;
  }

  /**
   * Update spinner color
   */
  color(color: string): this {
    this.spinner.color = color as 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray';
    return this;
  }

  /**
   * Change spinner style
   */
  style(style: keyof typeof SPINNER_STYLES): this {
    const spinnerStyle = SPINNER_STYLES[style];
    this.spinner.spinner = spinnerStyle;
    return this;
  }

  /**
   * Create a nested spinner
   */
  nested(options: SpinnerOptions = {}): SpinnerManager {
    // Stop current spinner temporarily
    this.spinner.stop();
    
    const nestedOptions = {
      ...options,
      indent: (this.options.indent || 0) + 2
    };
    
    const nested = new SpinnerManager(nestedOptions);
    nested.parent = this;
    this.nestedSpinners.push(nested);
    
    return nested;
  }

  /**
   * Remove a nested spinner
   */
  removeNested(spinner: SpinnerManager): void {
    const index = this.nestedSpinners.indexOf(spinner);
    if (index > -1) {
      this.nestedSpinners.splice(index, 1);
    }
    
    // Resume parent spinner if no more nested spinners
    if (this.nestedSpinners.length === 0) {
      this.spinner.start();
    }
  }

  /**
   * Clear the spinner
   */
  clear(): this {
    this.spinner.clear();
    return this;
  }

  /**
   * Check if spinner is spinning
   */
  isSpinning(): boolean {
    return this.spinner.isSpinning;
  }
}

/**
 * Enhanced progress bar with customization options
 */
export class ProgressBar {
  private bar: cliProgress.SingleBar;
  private options: ProgressBarOptions;
  private startTime: number = 0;
  private currentValue: number = 0;
  private totalValue: number = 0;

  constructor(options: ProgressBarOptions = {}) {
    this.options = {
      format: ' {spinner} {bar} {percentage}% | ETA: {eta}s | {value}/{total}',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      barsize: 40,
      clearOnComplete: false,
      stopOnComplete: false,
      hideCursor: true,
      linewrap: false,
      fps: 10,
      etaBuffer: 10,
      progressCharacter: '█',
      autopadding: true,
      autopaddingChar: ' ',
      align: 'left',
      gracefulExit: true,
      ...options
    };

    // Create custom formatter if not provided
    if (!this.options.formatBar) {
      this.options.formatBar = this.createGradientBar.bind(this);
    }

    this.bar = new cliProgress.SingleBar({
      format: this.options.format,
      barCompleteChar: this.options.barCompleteChar,
      barIncompleteChar: this.options.barIncompleteChar,
      barsize: this.options.barsize,
      clearOnComplete: this.options.clearOnComplete,
      stopOnComplete: this.options.stopOnComplete,
      hideCursor: this.options.hideCursor,
      linewrap: this.options.linewrap,
      fps: this.options.fps,
      etaBuffer: this.options.etaBuffer,
      formatBar: this.options.formatBar,
      formatValue: this.options.formatValue,
      formatTime: this.options.formatTime,
      align: this.options.align,
      gracefulExit: this.options.gracefulExit,
    });
  }

  /**
   * Start the progress bar
   */
  start(total: number, startValue: number = 0, payload?: Record<string, unknown>): void {
    this.startTime = Date.now();
    this.totalValue = total;
    this.currentValue = startValue;
    this.bar.start(total, startValue, payload);
  }

  /**
   * Update progress
   */
  update(value: number, payload?: Record<string, unknown>): void {
    this.currentValue = value;
    this.bar.update(value, payload);
  }

  /**
   * Increment progress
   */
  increment(delta: number = 1, payload?: Record<string, unknown>): void {
    this.currentValue += delta;
    this.bar.increment(delta, payload);
  }

  /**
   * Stop the progress bar
   */
  stop(): void {
    this.bar.stop();
  }

  /**
   * Get current progress percentage
   */
  getProgress(): number {
    return this.totalValue > 0 ? (this.currentValue / this.totalValue) * 100 : 0;
  }

  /**
   * Get estimated time remaining
   */
  getETA(): number {
    const elapsed = Date.now() - this.startTime;
    const progress = this.getProgress();
    
    if (progress === 0) return 0;
    
    const total = (elapsed / progress) * 100;
    return Math.max(0, (total - elapsed) / 1000);
  }

  /**
   * Create gradient color bar based on progress
   */
  private createGradientBar(progress: number, options: ProgressBarOptions): string {
    const barSize = options.barsize || 40;
    const completeSize = Math.round(progress * barSize);
    const incompleteSize = barSize - completeSize;
    
    let bar = '';
    
    // Create gradient effect
    for (let i = 0; i < completeSize; i++) {
      const ratio = i / barSize;
      if (ratio < 0.33) {
        bar += chalk.red(this.options.barCompleteChar);
      } else if (ratio < 0.66) {
        bar += chalk.yellow(this.options.barCompleteChar);
      } else {
        bar += chalk.green(this.options.barCompleteChar);
      }
    }
    
    bar += chalk.gray(this.options.barIncompleteChar?.repeat(incompleteSize));
    
    return bar;
  }

  /**
   * Update the format dynamically
   */
  setFormat(format: string): void {
    if (this.bar) {
      // @ts-expect-error - accessing private options property
      this.bar.options.format = format;
    }
  }
}

/**
 * Multi-progress manager for concurrent operations
 */
export class MultiProgress {
  private multiBar: cliProgress.MultiBar;
  private bars: Map<string, cliProgress.SingleBar> = new Map();
  private options: ProgressBarOptions;

  constructor(options: ProgressBarOptions = {}) {
    this.options = options;
    this.multiBar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: ' {name} | {bar} | {percentage}% | {eta}s | {value}/{total}',
      ...options
    });
  }

  /**
   * Create a new progress bar
   */
  create(name: string, total: number, startValue: number = 0): cliProgress.SingleBar {
    const bar = this.multiBar.create(total, startValue, { name });
    this.bars.set(name, bar);
    return bar;
  }

  /**
   * Update a specific bar
   */
  update(name: string, value: number, payload?: Record<string, unknown>): void {
    const bar = this.bars.get(name);
    if (bar) {
      bar.update(value, payload);
    }
  }

  /**
   * Remove a bar
   */
  remove(name: string): void {
    const bar = this.bars.get(name);
    if (bar) {
      this.multiBar.remove(bar);
      this.bars.delete(name);
    }
  }

  /**
   * Stop all bars
   */
  stop(): void {
    this.multiBar.stop();
  }

  /**
   * Get a specific bar
   */
  getBar(name: string): cliProgress.SingleBar | undefined {
    return this.bars.get(name);
  }
}

/**
 * Helper function to create a spinner with command defaults
 */
export function createSpinner(text: string, options: SpinnerOptions = {}): SpinnerManager {
  return new SpinnerManager({
    text,
    color: 'cyan',
    style: 'dots',
    ...options
  });
}

/**
 * Helper function to create a progress bar with command defaults
 */
export function createProgressBar(options: ProgressBarOptions = {}): ProgressBar {
  return new ProgressBar({
    format: ' {spinner} {bar} {percentage}% | ETA: {eta}s | {value}/{total}',
    barCompleteChar: '█',
    barIncompleteChar: '░',
    ...options
  });
}

/**
 * Helper function to create a multi-progress manager
 */
export function createMultiProgress(options: ProgressBarOptions = {}): MultiProgress {
  return new MultiProgress(options);
}

/**
 * Utility to run an async operation with a spinner
 */
export async function withSpinner<T>(
  text: string,
  operation: () => Promise<T>,
  options: SpinnerOptions = {}
): Promise<T> {
  const spinner = createSpinner(text, options);
  spinner.start();
  
  try {
    const result = await operation();
    spinner.succeed();
    return result;
  } catch (_error) {
    spinner.fail();
    throw error;
  }
}

/**
 * Utility to run an async operation with a progress bar
 */
export async function withProgressBar<T>(
  total: number,
  operation: (progress: ProgressBar) => Promise<T>,
  options: ProgressBarOptions = {}
): Promise<T> {
  const progress = createProgressBar(options);
  progress.start(total);
  
  try {
    const result = await operation(progress);
    progress.stop();
    return result;
  } catch (_error) {
    progress.stop();
    throw error;
  }
}

// Export spinner styles for external use
export { SPINNER_STYLES as SpinnerStyles };