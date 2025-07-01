import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command';
import { SPINNER_STYLES } from '../utils/progress-indicators';

/**
 * Demo command to showcase the progress indicator system
 */
export default class DemoProgress extends BaseCommand {
  static description = 'Demo the progress indicator system';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --type=spinner',
    '<%= config.bin %> <%= command.id %> --type=progress',
    '<%= config.bin %> <%= command.id %> --type=multi',
    '<%= config.bin %> <%= command.id %> --type=all',
  ];

  static flags = {
    ...BaseCommand.flags,
    type: Flags.string({
      description: 'Type of progress indicator to demo',
      options: ['spinner', 'progress', 'multi', 'nested', 'fun', 'all'],
      default: 'all',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DemoProgress);
    const demoType = flags.type;

    this.section(
      'Progress Indicators Demo',
      "Let's see some fancy progress indicators! 🎨"
    );

    switch (demoType) {
      case 'spinner':
        await this.demoSpinners();
        break;
      case 'progress':
        await this.demoProgressBars();
        break;
      case 'multi':
        await this.demoMultiProgress();
        break;
      case 'nested':
        await this.demoNestedSpinners();
        break;
      case 'fun':
        await this.demoFunSpinners();
        break;
      case 'all':
      default:
        await this.demoSpinners();
        await this.demoProgressBars();
        await this.demoMultiProgress();
        await this.demoNestedSpinners();
        await this.demoFunSpinners();
        break;
    }

    this.success('Demo completed! Hope you enjoyed the show! 🎉');
  }

  private async demoSpinners(): Promise<void> {
    this.simpleList('Basic Spinners', [
      'Various spinner styles',
      'Success/fail states',
      'Color variations',
    ]);

    // Basic spinner styles
    const styles = Object.keys(SPINNER_STYLES) as Array<
      keyof typeof SPINNER_STYLES
    >;

    for (const style of styles.slice(0, 6)) {
      await this.withSpinner(
        `Testing ${style} spinner style`,
        async () => {
          await this.delay(1500);
        },
        'Complete'
      );
    }

    // Success/fail examples
    const successSpinner = this.createSpinner('Loading something important...');
    successSpinner.start();
    await this.delay(1000);
    successSpinner.succeed('Operation successful!');

    const failSpinner = this.createSpinner('Trying something risky...');
    failSpinner.start();
    await this.delay(1000);
    failSpinner.fail('Oops! Something went wrong');

    const warnSpinner = this.createSpinner('Checking conditions...');
    warnSpinner.start();
    await this.delay(1000);
    warnSpinner.warn('Warning: Proceed with caution');

    const infoSpinner = this.createSpinner('Gathering information...');
    infoSpinner.start();
    await this.delay(1000);
    infoSpinner.info("Info: Here's something you should know");
  }

  private async demoProgressBars(): Promise<void> {
    this.simpleList('Progress Bars', [
      'Basic progress bar',
      'Gradient color bar',
      'Custom formats',
    ]);

    // Basic progress bar
    await this.withProgressBar(100, async progress => {
      for (let i = 0; i <= 100; i += 5) {
        progress.update(i, { task: 'Processing items' });
        await this.delay(100);
      }
    });

    // Gradient progress bar
    const gradientBar = this.createGradientProgressBar({
      format: ' {spinner} {bar} {percentage}% | Task: {task} | ETA: {eta}s',
    });

    gradientBar.start(100, 0, { task: 'Downloading' });
    for (let i = 0; i <= 100; i += 10) {
      gradientBar.update(i, { task: `Downloading chunk ${i / 10 + 1}/10` });
      await this.delay(200);
    }
    gradientBar.stop();

    // Custom format progress bar
    const customBar = this.createProgressBar({
      format: ' [{bar}] {percentage}% | {speed} MB/s | {downloaded}/{total} MB',
      barCompleteChar: '=',
      barIncompleteChar: '-',
    });

    customBar.start(1000, 0, { speed: 0, downloaded: 0, total: 1000 });
    for (let i = 0; i <= 1000; i += 50) {
      const speed = Math.floor(Math.random() * 10) + 5;
      customBar.update(i, { speed, downloaded: i, total: 1000 });
      await this.delay(150);
    }
    customBar.stop();
  }

  private async demoMultiProgress(): Promise<void> {
    this.simpleList('Multi-Progress', [
      'Concurrent operations',
      'Different progress rates',
      'Dynamic addition/removal',
    ]);

    const operations = [
      { name: 'Download Assets', total: 100 },
      { name: 'Process Images', total: 50 },
      { name: 'Optimize Code', total: 75 },
      { name: 'Generate Reports', total: 30 },
    ];

    await this.runWithMultiProgress(
      operations.map(({ name, total }) => ({
        name,
        total,
        operation: async bar => {
          const increment = Math.floor(total / 10);
          for (let i = 0; i <= total; i += increment) {
            bar.update(i);
            await this.delay(Math.random() * 300 + 100);
          }
          bar.update(total);
        },
      }))
    );
  }

  private async demoNestedSpinners(): Promise<void> {
    this.simpleList('Nested Spinners', [
      'Parent and child spinners',
      'Hierarchical progress',
      'Complex operations',
    ]);

    const mainSpinner = this.createSpinner('Starting main operation...');
    mainSpinner.start();
    await this.delay(1000);

    const subSpinner1 = mainSpinner.nested({
      text: 'Processing sub-task 1...',
    });
    subSpinner1.start();
    await this.delay(1500);
    subSpinner1.succeed('Sub-task 1 complete');

    const subSpinner2 = mainSpinner.nested({
      text: 'Processing sub-task 2...',
    });
    subSpinner2.start();
    await this.delay(1500);
    subSpinner2.succeed('Sub-task 2 complete');

    mainSpinner.succeed('Main operation complete!');
  }

  private async demoFunSpinners(): Promise<void> {
    this.simpleList('Fun Spinners', [
      'Walrus animation',
      'Sparkle effects',
      'Moon phases',
      'Star spinner',
    ]);

    // Walrus spinner
    const walrusSpinner = this.createFunSpinner(
      'Loading with Walrus power...',
      'walrus'
    );
    walrusSpinner.start();
    await this.delay(3000);
    walrusSpinner.succeed('Walrus is happy! 🦭');

    // Sparkle spinner
    const sparkleSpinner = this.createFunSpinner(
      'Adding some sparkle...',
      'sparkle'
    );
    sparkleSpinner.start();
    await this.delay(2000);
    sparkleSpinner.succeed('Sparkles added! ✨');

    // Moon spinner
    const moonSpinner = this.createFunSpinner('Moon phases loading...', 'moon');
    moonSpinner.start();
    await this.delay(2000);
    moonSpinner.succeed('Moon cycle complete! 🌙');

    // Star spinner
    const starSpinner = this.createFunSpinner(
      'Reaching for the stars...',
      'star'
    );
    starSpinner.start();
    await this.delay(2000);
    starSpinner.succeed('Stars aligned! ⭐');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
