#!/usr/bin/env ts-node

/**
 * This script analyzes storage requirements for various todo sizes and combinations.
 * It demonstrates how our optimization works by comparing calculated storage needs
 * with what would have been allocated without optimization.
 */

import { Todo, TodoList } from '../src/types/todo';
import { TodoSizeCalculator } from '../src/utils/todo-size-calculator';

// Generate a random string of specified length
function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';
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
    priority: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
    tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: Math.random() > 0.7
  };
}

// Test several different todo configurations
function analyzeSingleTodoSizes(): void {
  console.log('=== Single Todo Size Analysis ===');
  console.log('Format: Description | Raw Size | With Buffer | % Increase');
  console.log('--------------------------------------------------------------');
  
  // Test tiny todo
  const tinyTodo = generateTodo('tiny', 5, 10, 1);
  const tinySize = TodoSizeCalculator.calculateTodoSize(tinyTodo, { includeBuffer: false });
  const tinyWithBuffer = TodoSizeCalculator.calculateTodoSize(tinyTodo);
  console.log(`Tiny todo     | ${tinySize.toString().padStart(8)} | ${tinyWithBuffer.toString().padStart(11)} | ${((tinyWithBuffer/tinySize - 1) * 100).toFixed(2)}%`);
  
  // Test small todo
  const smallTodo = generateTodo('small', 15, 50, 2);
  const smallSize = TodoSizeCalculator.calculateTodoSize(smallTodo, { includeBuffer: false });
  const smallWithBuffer = TodoSizeCalculator.calculateTodoSize(smallTodo);
  console.log(`Small todo    | ${smallSize.toString().padStart(8)} | ${smallWithBuffer.toString().padStart(11)} | ${((smallWithBuffer/smallSize - 1) * 100).toFixed(2)}%`);
  
  // Test medium todo
  const mediumTodo = generateTodo('medium', 30, 200, 5);
  const mediumSize = TodoSizeCalculator.calculateTodoSize(mediumTodo, { includeBuffer: false });
  const mediumWithBuffer = TodoSizeCalculator.calculateTodoSize(mediumTodo);
  console.log(`Medium todo   | ${mediumSize.toString().padStart(8)} | ${mediumWithBuffer.toString().padStart(11)} | ${((mediumWithBuffer/mediumSize - 1) * 100).toFixed(2)}%`);
  
  // Test large todo
  const largeTodo = generateTodo('large', 50, 500, 10);
  const largeSize = TodoSizeCalculator.calculateTodoSize(largeTodo, { includeBuffer: false });
  const largeWithBuffer = TodoSizeCalculator.calculateTodoSize(largeTodo);
  console.log(`Large todo    | ${largeSize.toString().padStart(8)} | ${largeWithBuffer.toString().padStart(11)} | ${((largeWithBuffer/largeSize - 1) * 100).toFixed(2)}%`);
  
  // Test huge todo
  const hugeTodo = generateTodo('huge', 100, 2000, 20);
  const hugeSize = TodoSizeCalculator.calculateTodoSize(hugeTodo, { includeBuffer: false });
  const hugeWithBuffer = TodoSizeCalculator.calculateTodoSize(hugeTodo);
  console.log(`Huge todo     | ${hugeSize.toString().padStart(8)} | ${hugeWithBuffer.toString().padStart(11)} | ${((hugeWithBuffer/hugeSize - 1) * 100).toFixed(2)}%`);
  
  console.log('\n');
}

// Test batch upload optimization for different sets of todos
function analyzeBatchSizes(): void {
  console.log('=== Batch Upload Optimization Analysis ===');
  console.log('Format: Scenario | Total Raw Size | Optimized Size | Saved Bytes | Saved %');
  console.log('----------------------------------------------------------------------');
  
  // Test scenarios with different numbers of todos
  const scenarios = [
    { name: '3 small todos', count: 3, size: 'small' },
    { name: '5 small todos', count: 5, size: 'small' },
    { name: '10 small todos', count: 10, size: 'small' },
    { name: '3 medium todos', count: 3, size: 'medium' },
    { name: '5 medium todos', count: 5, size: 'medium' },
    { name: '3 large todos', count: 3, size: 'large' },
    { name: 'Mixed 10 todos', count: 10, size: 'mixed' }
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
      TodoSizeCalculator.calculateTodoSize(todo, { includeBuffer: false }));
    const totalRawSize = individualSizes.reduce((sum, size) => sum + size, 0);
    
    // Calculate optimized batch size
    const optimizedSize = TodoSizeCalculator.calculateOptimalStorageSize(todos);
    
    // Calculate savings
    const savedBytes = (totalRawSize + 1024 * todos.length) - optimizedSize;
    const savedPercent = (savedBytes / (totalRawSize + 1024 * todos.length)) * 100;
    
    // Calculate unoptimized size (each todo would need its own 1MB allocation)
    const unoptimizedSize = Math.max(1024 * 1024, totalRawSize) * todos.length;
    const walSaved = Math.floor((unoptimizedSize - optimizedSize) / 1024);
    
    console.log(`${scenario.name.padEnd(15)} | ${totalRawSize.toString().padStart(13)} | ${optimizedSize.toString().padStart(14)} | ${savedBytes.toString().padStart(11)} | ${savedPercent.toFixed(2).padStart(7)}%`);
    console.log(`  - Would require ${(unoptimizedSize / (1024 * 1024)).toFixed(2)} MB without batching, saves ~${walSaved} WAL tokens`);
  }
  
  console.log('\n');
}

// Test storage analysis for existing storage
function analyzeStorageRequirements(): void {
  console.log('=== Storage Requirements Analysis ===');
  console.log('Format: Scenario | Required | Available | Result | Remaining %');
  console.log('--------------------------------------------------------------');
  
  const scenarios = [
    { name: 'Plenty of space', required: 100 * 1024, available: 10 * 1024 * 1024 },
    { name: 'Adequate space', required: 1 * 1024 * 1024, available: 5 * 1024 * 1024 },
    { name: 'Tight space', required: 4.5 * 1024 * 1024, available: 5 * 1024 * 1024 },
    { name: 'Insufficient', required: 6 * 1024 * 1024, available: 5 * 1024 * 1024 },
    { name: 'Way too large', required: 50 * 1024 * 1024, available: 10 * 1024 * 1024 }
  ];
  
  for (const scenario of scenarios) {
    const analysis = TodoSizeCalculator.analyzeStorageRequirements(
      scenario.required,
      scenario.available
    );
    
    const requiredStr = `${(scenario.required / 1024).toFixed(2)} KB`;
    const availableStr = `${(scenario.available / 1024).toFixed(2)} KB`;
    const remainingPercent = analysis.remainingPercentage.toFixed(2);
    
    console.log(`${scenario.name.padEnd(16)} | ${requiredStr.padStart(9)} | ${availableStr.padStart(10)} | ${analysis.recommendation.padEnd(9)} | ${remainingPercent.padStart(6)}%`);
  }
  
  console.log('\n');
}

// Run all the analysis functions
function main(): void {
  console.log('\n==================================================');
  console.log('  WALRUS TODO STORAGE OPTIMIZATION ANALYSIS');
  console.log('==================================================\n');
  
  analyzeSingleTodoSizes();
  analyzeBatchSizes();
  analyzeStorageRequirements();
  
  console.log('Analysis complete. These results show how storage optimizations');
  console.log('can save significant amounts of WAL tokens when storing todos,');
  console.log('especially when using batch uploads for multiple todos.\n');
}

// Run the main function
main();