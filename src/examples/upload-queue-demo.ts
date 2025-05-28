#!/usr/bin/env node

/**
 * @fileoverview Upload Queue Demo - Demonstrates the async upload queue system
 * 
 * This script shows how to use the upload queue for background uploads
 * and monitor progress without blocking the CLI.
 */

import { createUploadQueue } from '../utils/upload-queue';
import { createNotificationSystem } from '../utils/notification-system';
import { Todo } from '../types/todo';
import chalk = require('chalk');

async function demoUploadQueue() {
  console.log(chalk.cyan.bold('🚀 Upload Queue Demo\n'));

  // Create upload queue with custom settings
  const queue = createUploadQueue({
    maxConcurrency: 2,
    retryDelayMs: 1000,
    maxRetries: 2,
    enableNotifications: true,
  });

  // Create notification system
  const notifications = createNotificationSystem({
    enableCLI: true,
    verbosity: 'normal',
  });

  // Setup event listeners
  queue.on('jobStarted', (job) => {
    console.log(chalk.blue(`🔄 Started: ${job.id} (${job.type})`));
  });

  queue.on('jobProgress', (progress) => {
    process.stdout.write(`\r⏳ ${progress.message} (${progress.progress}%)`);
  });

  queue.on('jobCompleted', (job) => {
    console.log(chalk.green(`\n✅ Completed: ${job.id} -> ${job.blobId}`));
  });

  queue.on('jobFailed', (job) => {
    console.log(chalk.red(`\n❌ Failed: ${job.id} - ${job.error}`));
  });

  // Create sample todos
  const sampleTodos: Todo[] = [
    {
      id: 'demo-1',
      title: 'Sample Todo 1',
      description: 'This is a demo todo for testing the upload queue',
      completed: false,
      priority: 'medium',
      tags: ['demo', 'test'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: false,
      storageLocation: 'local',
    },
    {
      id: 'demo-2',
      title: 'Sample Todo 2',
      description: 'Another demo todo with different priority',
      completed: false,
      priority: 'high',
      tags: ['demo', 'urgent'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: false,
      storageLocation: 'local',
    },
    {
      id: 'demo-3',
      title: 'Sample Todo 3',
      description: 'A low priority demo todo',
      completed: true,
      priority: 'low',
      tags: ['demo', 'completed'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: false,
      storageLocation: 'local',
    },
  ];

  try {
    console.log(chalk.yellow('📋 Adding todos to upload queue...\n'));

    // Add todos to queue with different priorities
    const jobIds: string[] = [];

    for (const todo of sampleTodos) {
      const jobId = await queue.addTodoJob(todo, {
        priority: todo.priority as 'low' | 'medium' | 'high',
        epochs: 5,
        network: 'testnet',
        listName: 'demo-list',
        maxRetries: 2,
      });

      jobIds.push(jobId);
      console.log(`✓ Queued: ${chalk.yellow(todo.title)} (Priority: ${chalk.cyan(todo.priority)})`);
    }

    console.log(`\n📊 Queue Status:`);
    const stats = await queue.getStats();
    console.log(`  Pending: ${chalk.yellow(stats.pending)}`);
    console.log(`  Processing: ${chalk.blue(stats.processing)}`);
    console.log(`  Completed: ${chalk.green(stats.completed)}`);
    console.log(`  Failed: ${chalk.red(stats.failed)}`);

    console.log(`\n👀 Watching queue progress... (jobs will run in mock mode)\n`);

    // Monitor until all jobs complete
    const completedJobs = new Set<string>();
    let monitoring = true;

    queue.on('jobCompleted', (job) => {
      completedJobs.add(job.id);
      if (completedJobs.size === jobIds.length) {
        monitoring = false;
      }
    });

    queue.on('jobFailed', (job) => {
      completedJobs.add(job.id);
      if (completedJobs.size === jobIds.length) {
        monitoring = false;
      }
    });

    // Wait for all jobs to complete
    while (monitoring && completedJobs.size < jobIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n');
    console.log(chalk.green.bold('🎉 Demo completed!'));

    // Show final stats
    const finalStats = await queue.getStats();
    console.log('\n📈 Final Statistics:');
    console.log(`  Total Jobs: ${chalk.cyan(finalStats.total)}`);
    console.log(`  Successful: ${chalk.green(finalStats.completed)}`);
    console.log(`  Failed: ${chalk.red(finalStats.failed)}`);
    console.log(`  Success Rate: ${chalk.cyan((finalStats.successRate * 100).toFixed(1) + '%')}`);

    // Show recent notifications
    const recentNotifications = notifications.getNotifications().slice(0, 5);
    if (recentNotifications.length > 0) {
      console.log('\n📢 Recent Notifications:');
      for (const notification of recentNotifications) {
        const timestamp = notification.timestamp.toLocaleTimeString();
        const icon = notification.type === 'success' ? '✅' : 
                    notification.type === 'error' ? '❌' : 
                    notification.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`  ${icon} [${timestamp}] ${notification.title}: ${notification.message}`);
      }
    }

  } catch (error) {
    console.error(chalk.red('❌ Demo failed:'), error);
  } finally {
    // Cleanup
    await queue.shutdown();
    console.log('\n' + chalk.gray('Upload queue shut down.'));
  }
}

// Command line interface
if (require.main === module) {
  console.log(chalk.yellow('Starting upload queue demo...\n'));
  
  demoUploadQueue()
    .then(() => {
      console.log(chalk.green('\nDemo finished successfully!'));
      process.exit(0);
    })
    .catch((error) => {
      console.error(chalk.red('\nDemo failed:'), error);
      process.exit(1);
    });
}

export { demoUploadQueue };