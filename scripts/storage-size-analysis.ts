#!/usr/bin/env ts-node

/**
 * This script analyzes storage requirements for various todo sizes and combinations.
 * It demonstrates how our optimization works by comparing calculated storage needs
 * with what would have been allocated without optimization.
 */

import { Todo } from '../src/types/todo';
import { TodoSizeCalculator } from '../src/utils/todo-size-calculator';

// Generate a random string of specified length
function randomString(length: number): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate a random todo with specified content sizes
function generateTodo(
  id: string,
  titleLength: number = 20,
  descriptionLength: number = 100,
  tagsCount: number = 3
): Todo {
  const tags = [];
  for (let i = 0; i < tagsCount; i++) {
    tags.push(randomString(5 + Math.floor(Math.random() * 10)));
  }

  return {
    id,
    title: randomString(titleLength),
    description: randomString(descriptionLength),
    completed: Math.random() > 0.5,
    priority:
      Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
    tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: Math.random() > 0.7,
  };
}

// Test several different todo configurations
function analyzeSingleTodoSizes(): void {
  process.stdout.write('=== Single Todo Size Analysis ===\n');
  process.stdout.write(
    'Format: Description | Raw Size | With Buffer | % Increase\n'
  );
  process.stdout.write(
    '--------------------------------------------------------------\n'
  );

  // Test tiny todo
  const tinyTodo = generateTodo('tiny', 5, 10, 1);
  const tinySize = TodoSizeCalculator.calculateTodoSize(tinyTodo, {
    includeBuffer: false,
  });
  const tinyWithBuffer = TodoSizeCalculator.calculateTodoSize(tinyTodo);
  process.stdout.write(
    `Tiny todo     | ${tinySize.toString().padStart(8)} | ${tinyWithBuffer.toString().padStart(11)} | ${((tinyWithBuffer / tinySize - 1) * 100).toFixed(2)}%\n`
  );

  // Test small todo
  const smallTodo = generateTodo('small', 15, 50, 2);
  const smallSize = TodoSizeCalculator.calculateTodoSize(smallTodo, {
    includeBuffer: false,
  });
  const smallWithBuffer = TodoSizeCalculator.calculateTodoSize(smallTodo);
  process.stdout.write(
    `Small todo    | ${smallSize.toString().padStart(8)} | ${smallWithBuffer.toString().padStart(11)} | ${((smallWithBuffer / smallSize - 1) * 100).toFixed(2)}%\n`
  );

  // Test medium todo
  const mediumTodo = generateTodo('medium', 30, 200, 5);
  const mediumSize = TodoSizeCalculator.calculateTodoSize(mediumTodo, {
    includeBuffer: false,
  });
  const mediumWithBuffer = TodoSizeCalculator.calculateTodoSize(mediumTodo);
  process.stdout.write(
    `Medium todo   | ${mediumSize.toString().padStart(8)} | ${mediumWithBuffer.toString().padStart(11)} | ${((mediumWithBuffer / mediumSize - 1) * 100).toFixed(2)}%\n`
  );

  // Test large todo
  const largeTodo = generateTodo('large', 50, 500, 10);
  const largeSize = TodoSizeCalculator.calculateTodoSize(largeTodo, {
    includeBuffer: false,
  });
  const largeWithBuffer = TodoSizeCalculator.calculateTodoSize(largeTodo);
  process.stdout.write(
    `Large todo    | ${largeSize.toString().padStart(8)} | ${largeWithBuffer.toString().padStart(11)} | ${((largeWithBuffer / largeSize - 1) * 100).toFixed(2)}%\n`
  );

  // Test huge todo
  const hugeTodo = generateTodo('huge', 100, 2000, 20);
  const hugeSize = TodoSizeCalculator.calculateTodoSize(hugeTodo, {
    includeBuffer: false,
  });
  const hugeWithBuffer = TodoSizeCalculator.calculateTodoSize(hugeTodo);
  process.stdout.write(
    `Huge todo     | ${hugeSize.toString().padStart(8)} | ${hugeWithBuffer.toString().padStart(11)} | ${((hugeWithBuffer / hugeSize - 1) * 100).toFixed(2)}%\n`
  );

  process.stdout.write('\n');
}

// Test batch upload optimization for different sets of todos
function analyzeBatchSizes(): void {
  process.stdout.write('=== Batch Upload Optimization Analysis ===\n');
  process.stdout.write(
    'Format: Scenario | Total Raw Size | Optimized Size | Saved Bytes | Saved %\n'
  );
  process.stdout.write(
    '----------------------------------------------------------------------\n'
  );

  // Test scenarios with different numbers of todos
  const scenarios = [
    { name: '3 small todos', count: 3, size: 'small' },
    { name: '5 small todos', count: 5, size: 'small' },
    { name: '10 small todos', count: 10, size: 'small' },
    { name: '3 medium todos', count: 3, size: 'medium' },
    { name: '5 medium todos', count: 5, size: 'medium' },
    { name: '3 large todos', count: 3, size: 'large' },
    { name: 'Mixed 10 todos', count: 10, size: 'mixed' },
  ];

  for (const scenario of scenarios) {
    const todos: Todo[] = [];

    // Generate the specified number of todos
    for (let i = 0; i < scenario.count; i++) {
      if (scenario.size === 'mixed') {
        // For mixed scenario, use a variety of todo sizes
        const sizes = ['tiny', 'small', 'medium', 'large'];
        const size = sizes[Math.floor(Math.random() * sizes.length)];

        switch (size) {
          case 'tiny':
            todos.push(generateTodo(`mixed-${i}`, 5, 10, 1));
            break;
          case 'small':
            todos.push(generateTodo(`mixed-${i}`, 15, 50, 2));
            break;
          case 'medium':
            todos.push(generateTodo(`mixed-${i}`, 30, 200, 5));
            break;
          case 'large':
            todos.push(generateTodo(`mixed-${i}`, 50, 500, 10));
            break;
        }
      } else {
        // For uniform scenarios, use the specified size
        switch (scenario.size) {
          case 'small':
            todos.push(generateTodo(`${scenario.size}-${i}`, 15, 50, 2));
            break;
          case 'medium':
            todos.push(generateTodo(`${scenario.size}-${i}`, 30, 200, 5));
            break;
          case 'large':
            todos.push(generateTodo(`${scenario.size}-${i}`, 50, 500, 10));
            break;
        }
      }
    }

    // Calculate individual sizes
    const individualSizes = todos.map(todo =>
      TodoSizeCalculator.calculateTodoSize(todo, { includeBuffer: false })
    );
    const totalRawSize = individualSizes.reduce((sum, size) => sum + size, 0);

    // Calculate optimized batch size
    const optimizedSize = TodoSizeCalculator.calculateOptimalStorageSize(todos);

    // Calculate savings
    const savedBytes = totalRawSize + 1024 * todos.length - optimizedSize;
    const savedPercent =
      (savedBytes / (totalRawSize + 1024 * todos.length)) * 100;

    // Calculate unoptimized size (each todo would need its own 1MB allocation)
    const unoptimizedSize = Math.max(1024 * 1024, totalRawSize) * todos.length;
    const walSaved = Math.floor((unoptimizedSize - optimizedSize) / 1024);

    process.stdout.write(
      `${scenario.name.padEnd(15)} | ${totalRawSize.toString().padStart(13)} | ${optimizedSize.toString().padStart(14)} | ${savedBytes.toString().padStart(11)} | ${savedPercent.toFixed(2).padStart(7)}%\n`
    );
    process.stdout.write(
      `  - Would require ${(unoptimizedSize / (1024 * 1024)).toFixed(2)} MB without batching, saves ~${walSaved} WAL tokens\n`
    );
  }

  process.stdout.write('\n');
}

// Test storage analysis for existing storage
function analyzeStorageRequirements(): void {
  process.stdout.write('=== Storage Requirements Analysis ===\n');
  process.stdout.write(
    'Format: Scenario | Required | Available | Result | Remaining %\n'
  );
  process.stdout.write(
    '--------------------------------------------------------------\n'
  );

  const scenarios = [
    {
      name: 'Plenty of space',
      required: 100 * 1024,
      available: 10 * 1024 * 1024,
    },
    {
      name: 'Adequate space',
      required: 1 * 1024 * 1024,
      available: 5 * 1024 * 1024,
    },
    {
      name: 'Tight space',
      required: 4.5 * 1024 * 1024,
      available: 5 * 1024 * 1024,
    },
    {
      name: 'Insufficient',
      required: 6 * 1024 * 1024,
      available: 5 * 1024 * 1024,
    },
    {
      name: 'Way too large',
      required: 50 * 1024 * 1024,
      available: 10 * 1024 * 1024,
    },
  ];

  for (const scenario of scenarios) {
    const analysis = TodoSizeCalculator.analyzeStorageRequirements(
      scenario.required,
      scenario.available
    );

    const requiredStr = `${(scenario.required / 1024).toFixed(2)} KB`;
    const availableStr = `${(scenario.available / 1024).toFixed(2)} KB`;
    const remainingPercent = analysis.remainingPercentage.toFixed(2);

    process.stdout.write(
      `${scenario.name.padEnd(16)} | ${requiredStr.padStart(9)} | ${availableStr.padStart(10)} | ${analysis.recommendation.padEnd(9)} | ${remainingPercent.padStart(6)}%\n`
    );
  }

  process.stdout.write('\n');
}

// Run all the analysis functions
function main(): void {
  process.stdout.write(
    '\n==================================================\n'
  );
  process.stdout.write('  WALRUS TODO STORAGE OPTIMIZATION ANALYSIS\n');
  process.stdout.write(
    '==================================================\n\n'
  );

  analyzeSingleTodoSizes();
  analyzeBatchSizes();
  analyzeStorageRequirements();

  process.stdout.write(
    'Analysis complete. These results show how storage optimizations\n'
  );
  process.stdout.write(
    'can save significant amounts of WAL tokens when storing todos,\n'
  );
  process.stdout.write(
    'especially when using batch uploads for multiple todos.\n\n'
  );
}

// Run the main function
main();
