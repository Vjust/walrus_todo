import chalk from 'chalk';

// Import just the icon definitions for demo purposes
const ICONS = {
  // Status icons - more playful and fun
  SUCCESS: '🎉', // Celebration instead of checkmark
  ERROR: '💥', // Explosion instead of X
  WARNING: '⚡️', // Lightning instead of warning
  INFO: '💡', // Lightbulb instead of info
  PENDING: '🕐', // Clock instead of circle
  ACTIVE: '🟢', // Green circle
  LOADING: '🔄', // Rotating arrows
  DEBUG: '🔮', // Crystal ball instead of magnifying glass

  // Object icons - more vibrant
  TODO: '✨', // Sparkles for todos
  LIST: '📋', // Clipboard
  LISTS: '📚', // Books
  TAG: '🏷️', // Tag
  PRIORITY: '🔥', // Fire instead of lightning
  DATE: '📆', // Calendar
  TIME: '⏰', // Alarm clock

  // Feature icons - playful alternatives
  BLOCKCHAIN: '⛓️', // Chain
  WALRUS: '🦭', // Actual walrus emoji
  LOCAL: '🏠', // House instead of computer
  HYBRID: '🧩', // Puzzle piece instead of arrows
  AI: '🧠', // Brain instead of robot
  STORAGE: '📦', // Box instead of disk
  CONFIG: '🛠️', // Tools
  USER: '😎', // Cool face instead of user
  SEARCH: '🔍', // Magnifying glass
  SECURE: '🔐', // Locked with key
  INSECURE: '🔓', // Unlocked

  // UI elements - more unique
  BULLET: '•',
  ARROW: '➜', // Different arrow
  BOX_V: '│',
  BOX_H: '─',
  BOX_TL: '┌',
  BOX_TR: '┐',
  BOX_BL: '└',
  BOX_BR: '┘',
  LINE: '·',
};

// Priority definitions
const PRIORITY = {
  high: {
    color: chalk.red.bold,
    icon: '🔥', // Fire for high priority
    label: 'HOT!',
    value: 3,
  },
  medium: {
    color: chalk.yellow.bold,
    icon: '⚡', // Lightning for medium priority
    label: 'SOON',
    value: 2,
  },
  low: {
    color: chalk.green,
    icon: '🍃', // Leaf for low priority
    label: 'CHILL',
    value: 1,
  },
};

// Storage types
const STORAGE = {
  local: {
    color: chalk.green.bold,
    icon: ICONS.LOCAL,
    label: 'Home Base',
  },
  blockchain: {
    color: chalk.blue.bold,
    icon: ICONS.BLOCKCHAIN,
    label: 'On Chain',
  },
  both: {
    color: chalk.magenta.bold,
    icon: ICONS.HYBRID,
    label: 'Everywhere!',
  },
};

/**
 * Demo functions
 */
function showSuccess(message: string): void {
  const sparkles = chalk.magenta('✨');
  process.stdout.write(
    `${sparkles} ${chalk.green.bold(`${ICONS.SUCCESS} ${message}`)} ${sparkles}\n`
  );
}

function showInfo(message: string): void {
  process.stdout.write(chalk.cyan.bold(`${ICONS.INFO} ${message}`) + '\n');
}

function showWarning(message: string): void {
  process.stdout.write(chalk.yellow.bold(`${ICONS.WARNING} ${message}`) + '\n');
}

function showError(title: string, message: string, suggestion?: string): void {
  let output = `\n${chalk.bgRed.white(' OOPS! ')} ${chalk.red.bold(title)}\n`;
  output += `${chalk.red(ICONS.ERROR)} ${message}\n`;

  if (suggestion) {
    output += `\n${chalk.yellow(ICONS.INFO)} ${chalk.yellow('Pro tip:')}\n`;
    output += `  ${chalk.cyan(suggestion)}\n`;
  }

  process.stdout.write(output);
}

function showSection(title: string, content: string): void {
  const lines = content.split('\n');
  const width = Math.max(...lines.map(line => line.length), title.length + 4);

  // Pick a random fun color for the box
  const boxColors = [
    chalk.cyan,
    chalk.magenta,
    chalk.green,
    chalk.yellow,
    chalk.blue,
  ];
  const boxColor = boxColors[Math.floor(Math.random() * boxColors.length)];

  // Random decorative emoji for the section title
  const decorations = ['✨', '🌟', '💫', '🚀', '💥', '🔮', '🧩', '🎯'];
  const decoration =
    decorations[Math.floor(Math.random() * decorations.length)];

  // Top border with title and decoration
  process.stdout.write(
    boxColor(
      `${ICONS.BOX_TL}${ICONS.BOX_H}[ ${decoration} ${chalk.bold.white(title)} ${decoration} ]${ICONS.BOX_H.repeat(width - title.length - 8)}${ICONS.BOX_TR}`
    ) + '\n'
  );

  // Content with colorful borders
  lines.forEach(line => {
    const padding = width - line.length;
    process.stdout.write(
      `${boxColor(ICONS.BOX_V)} ${line}${' '.repeat(padding)} ${boxColor(ICONS.BOX_V)}\n`
    );
  });

  // Bottom border
  process.stdout.write(
    boxColor(`${ICONS.BOX_BL}${ICONS.BOX_H.repeat(width + 2)}${ICONS.BOX_BR}`) +
      '\n'
  );
}

function showSimpleList(title: string, items: string[]): void {
  // Fun bullet point variations
  const bullets = ['🔹', '🔸', '💠', '🔻', '🔶', '🔷', '🔸', '🔹'];

  // Title with fun decorations
  process.stdout.write(chalk.bold(`\n✧ ${chalk.underline(title)} ✧`) + '\n');

  // List items with alternating bullets and subtle coloring
  items.forEach((item, index) => {
    const bullet = bullets[index % bullets.length];
    // Alternate text colors for adjacent items
    const itemText = index % 2 === 0 ? chalk.cyan(item) : chalk.white(item);
    process.stdout.write(`  ${bullet} ${itemText}\n`);
  });

  process.stdout.write('\n');
}

function formatTodo(todo: any): string {
  // Status indicators with more personality
  const status = todo.completed
    ? chalk.green.bold(`${ICONS.SUCCESS} `) // Celebration
    : chalk.yellow(`${ICONS.PENDING} `); // Clock

  // Get priority with our new fun labels
  const priority =
    PRIORITY[todo.priority as keyof typeof PRIORITY] || PRIORITY.medium;

  // Construct the priority badge with the icon and label
  const priorityBadge = priority.color(`${priority.icon} ${priority.label}`);

  // Make the title pop with subtle formatting (but not too much)
  const titleFormatted = todo.completed
    ? chalk.dim.strikethrough(todo.title) // Strikethrough for completed todos
    : chalk.white.bold(todo.title); // Bold for pending todos

  // Start building a fun output
  let output = `${status}${priorityBadge} ${titleFormatted}`;

  // Add fun details with more personality
  if (todo.dueDate || (todo.tags && todo.tags.length) || todo.private) {
    const details = [
      todo.dueDate && chalk.blue(`${ICONS.DATE} ${todo.dueDate}`),
      todo.tags?.length && chalk.cyan(`${ICONS.TAG} ${todo.tags.join(', ')}`),
      todo.private && chalk.yellow(`${ICONS.SECURE} Eyes only!`),
    ].filter(Boolean);

    if (details.length) {
      output += `\n   ${details.join(' │ ')}`;
    }
  }

  return output;
}

function formatStorage(storageType: string): string {
  const storage = STORAGE[storageType as keyof typeof STORAGE] || STORAGE.local;

  // Add a playful animation-like effect with brackets
  return `[${storage.icon}] ${storage.color(storage.label)} [${storage.icon}]`;
}

/**
 * Run the demo
 */
function runDemo() {
  process.stdout.write('\n🎨 WALRUS TODO CLI STYLE SHOWCASE 🎨\n\n');

  // Demo the different status messages
  process.stdout.write(chalk.bold.underline('Status Messages:') + '\n');
  showSuccess('Task completed successfully!');
  showInfo('Here is some helpful information');
  showWarning('Be careful with this operation');
  showError(
    'Something went wrong',
    'Could not connect to the server',
    'Try checking your internet connection or try again later'
  );

  // Demo section boxes
  process.stdout.write(chalk.bold.underline('\nFun Section Boxes:') + '\n');
  showSection(
    'Quick Tips',
    'Here are some helpful tips for using the CLI:\n' +
      '- Use "list" to see all your todos\n' +
      '- Use "add" to create new todos\n' +
      '- Use "complete" to mark todos as done'
  );

  // Demo the simple list
  process.stdout.write(
    chalk.bold.underline('\nColored Lists with Fun Bullets:') + '\n'
  );
  showSimpleList('Available Commands', [
    'add - Create a new todo',
    'list - Show all todos',
    'complete - Mark a todo as done',
    'delete - Remove a todo',
    'update - Edit a todo',
  ]);

  // Demo todo formatting
  process.stdout.write(chalk.bold.underline('\nTodo Formatting:') + '\n');

  const todos = [
    {
      id: '123',
      title: 'Finish project presentation',
      completed: false,
      priority: 'high',
      dueDate: '2025-05-15',
      tags: ['work', 'important'],
    },
    {
      id: '456',
      title: 'Buy groceries',
      completed: false,
      priority: 'medium',
      tags: ['personal'],
    },
    {
      id: '789',
      title: 'Call Mom',
      completed: true,
      priority: 'low',
      private: true,
    },
  ];

  todos.forEach(todo => {
    process.stdout.write(formatTodo(todo) + '\n');
    process.stdout.write('\n'); // Add spacing
  });

  // Demo storage types
  process.stdout.write(chalk.bold.underline('\nStorage Types:') + '\n');
  process.stdout.write(`Local storage: ${formatStorage('local')}\n`);
  process.stdout.write(`Blockchain storage: ${formatStorage('blockchain')}\n`);
  process.stdout.write(`Hybrid storage: ${formatStorage('both')}\n`);

  // Demo all the icons
  process.stdout.write(chalk.bold.underline('\nFun Icons:') + '\n');

  // Group the icons by category
  const iconGroups = {
    'Status Icons': [
      'SUCCESS',
      'ERROR',
      'WARNING',
      'INFO',
      'PENDING',
      'ACTIVE',
      'LOADING',
      'DEBUG',
    ],
    'Object Icons': [
      'TODO',
      'LIST',
      'LISTS',
      'TAG',
      'PRIORITY',
      'DATE',
      'TIME',
    ],
    'Feature Icons': [
      'BLOCKCHAIN',
      'WALRUS',
      'LOCAL',
      'HYBRID',
      'AI',
      'STORAGE',
      'CONFIG',
      'USER',
      'SEARCH',
      'SECURE',
      'INSECURE',
    ],
  };

  // Display all icon groups
  Object.entries(iconGroups).forEach(([groupName, iconNames]) => {
    process.stdout.write(chalk.yellow(`\n${groupName}:`) + '\n');

    let line = '';
    iconNames.forEach(name => {
      const icon = ICONS[name as keyof typeof ICONS];
      line += `${icon} ${name.padEnd(12)}`;

      // Break into multiple lines for readability
      if (line.length > 50) {
        process.stdout.write(line + '\n');
        line = '';
      }
    });

    if (line) process.stdout.write(line + '\n');
  });

  process.stdout.write('\n✨ End of Style Demo ✨\n\n');
}

// Run the demo
runDemo();
