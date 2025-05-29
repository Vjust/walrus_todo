#!/usr/bin/env node

/**
 * Background worker for update operations
 * This script runs update operations in the background without blocking the terminal
 */

const { TodoService } = require('../services/todoService');
const { jobManager } = require('./PerformanceMonitor');
const {
  createBackgroundOperationsManager,
} = require('./background-operations');
const { validateDate, validatePriority } = require('../utils');
const { CLIError } = require('../types/errors/consolidated');

class BackgroundUpdateWorker {
  constructor(jobId, args, flags) {
    this.jobId = jobId;
    this.args = JSON.parse(args);
    this.flags = JSON.parse(flags);
    this.todoService = new TodoService();
    this.progressTotal = 100;
    this.currentProgress = 0;
  }

  async run() {
    try {
      jobManager.startJob(this.jobId, process.pid);
      jobManager.writeJobLog(this.jobId, 'Background update worker started');

      // Update progress
      this.updateProgress(10, 'Parsing arguments...');

      // Parse arguments and find todo
      const { todo, listName } = await this.findTodo();

      this.updateProgress(30, 'Found todo, processing updates...');

      // Process update with batch handling if needed
      const updateResult = await this.processUpdate(todo);

      this.updateProgress(60, 'Saving changes...');

      // Save the list
      const list = await this.todoService.getList(listName);
      if (!list) {
        throw new Error(`List "${listName}" not found`);
      }
      await this.todoService.saveList(listName, list);

      this.updateProgress(80, 'Handling post-update operations...');

      // Handle background operations (storage sync, AI enhancement)
      await this.handlePostUpdateOperations(updateResult, listName);

      this.updateProgress(100, 'Update completed successfully');

      // Complete the job
      jobManager.completeJob(this.jobId, {
        todo: updateResult.todo,
        changes: updateResult.changes,
        listName,
        completedAt: new Date().toISOString(),
      });

      jobManager.writeJobLog(
        this.jobId,
        `Update completed: ${updateResult.changes} changes made to "${updateResult.todo.title}"`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      jobManager.failJob(this.jobId, errorMessage);
      jobManager.writeJobLog(this.jobId, `Error: ${errorMessage}`);
      process.exit(1);
    }
  }

  async findTodo() {
    const { args, flags } = this;
    let listName = '';
    let todoIdentifier = '';
    let searchAllLists = false;

    // Parse arguments (same logic as main command)
    if (args.listName && !args.todoId && !args.newTitle && !flags.id) {
      searchAllLists = true;
      todoIdentifier = args.listName;
    } else if (args.listName && args.todoId && !args.newTitle) {
      const list = await this.todoService.getList(args.listName);
      if (list) {
        listName = args.listName;
        todoIdentifier = args.todoId;
      } else {
        searchAllLists = true;
        todoIdentifier = args.listName;
      }
    } else if (args.listName && args.todoId && args.newTitle) {
      listName = args.listName;
      todoIdentifier = args.todoId;
    } else if (flags.id) {
      if (!args.listName) {
        throw new Error('List name is required when using flag syntax');
      }
      listName = args.listName;
      todoIdentifier = flags.id;
    } else {
      throw new Error('Please specify a todo to update');
    }

    // Find the todo
    let todo = null;
    let finalListName = listName;

    if (searchAllLists) {
      const lists = await this.todoService.getAllListsWithContent();
      for (const [name, list] of Object.entries(lists)) {
        const found = await this.todoService.getTodoByTitleOrId(
          todoIdentifier,
          name
        );
        if (found) {
          todo = found;
          finalListName = name;
          break;
        }
      }
      if (!todo) {
        throw new Error(`Todo "${todoIdentifier}" not found in any list`);
      }
    } else {
      const list = await this.todoService.getList(listName);
      if (!list) {
        throw new Error(`List "${listName}" not found`);
      }
      todo = await this.todoService.getTodoByTitleOrId(
        todoIdentifier,
        listName
      );
      if (!todo) {
        throw new Error(
          `Todo "${todoIdentifier}" not found in list "${listName}"`
        );
      }
    }

    return { todo, listName: finalListName };
  }

  async processUpdate(todo) {
    const { flags, args } = this;
    let changes = 0;
    const newTitle = args.newTitle;

    // Process batch updates if multiple items (future enhancement)
    const batchSize = flags['batch-size'] || 1;

    if (batchSize > 1) {
      jobManager.writeJobLog(
        this.jobId,
        `Processing with batch size: ${batchSize}`
      );
      // For now, we process single item but infrastructure is ready for batches
    }

    // Update title
    if (newTitle || flags.task) {
      todo.title = newTitle || flags.task || todo.title;
      changes++;
      jobManager.writeJobLog(this.jobId, `Title updated to: ${todo.title}`);
    }

    // Update priority
    if (flags.priority) {
      if (!validatePriority(flags.priority)) {
        throw new Error('Invalid priority. Must be high, medium, or low');
      }
      todo.priority = flags.priority;
      changes++;
      jobManager.writeJobLog(
        this.jobId,
        `Priority updated to: ${flags.priority}`
      );
    }

    // Update due date
    if (flags.due) {
      if (!validateDate(flags.due)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
      }
      todo.dueDate = flags.due;
      changes++;
      jobManager.writeJobLog(this.jobId, `Due date updated to: ${flags.due}`);
    }

    // Clear due date
    if (flags['clear-due']) {
      todo.dueDate = undefined;
      changes++;
      jobManager.writeJobLog(this.jobId, 'Due date cleared');
    }

    // Update tags
    if (flags.tags) {
      todo.tags = flags.tags.split(',').map(tag => tag.trim());
      changes++;
      jobManager.writeJobLog(
        this.jobId,
        `Tags updated to: ${todo.tags.join(', ')}`
      );
    }

    // Clear tags
    if (flags['clear-tags']) {
      todo.tags = [];
      changes++;
      jobManager.writeJobLog(this.jobId, 'Tags cleared');
    }

    // Update private flag
    if (flags.private !== undefined) {
      todo.private = flags.private;
      changes++;
      jobManager.writeJobLog(
        this.jobId,
        `Privacy updated to: ${flags.private ? 'private' : 'public'}`
      );
    }

    if (changes === 0) {
      throw new Error('No changes specified');
    }

    todo.updatedAt = new Date().toISOString();

    return { todo, changes };
  }

  async handlePostUpdateOperations(updateResult, listName) {
    const { todo } = updateResult;
    const { flags } = this;

    // Handle storage synchronization
    if (flags['sync-storage']) {
      try {
        jobManager.writeJobLog(
          this.jobId,
          'Starting storage synchronization...'
        );
        const backgroundOps = await createBackgroundOperationsManager();

        const syncJobId = await backgroundOps.uploadTodosInBackground([todo], {
          priority: 'normal',
        });

        jobManager.writeJobLog(this.jobId, `Storage sync queued: ${syncJobId}`);

        // Wait for sync to complete
        await backgroundOps.waitForOperationWithProgress(
          syncJobId,
          progress => {
            jobManager.writeJobLog(
              this.jobId,
              `Storage sync progress: ${progress}%`
            );
          }
        );

        jobManager.writeJobLog(this.jobId, 'Storage synchronization completed');
      } catch (error) {
        jobManager.writeJobLog(
          this.jobId,
          `Storage sync warning: ${error.message}`
        );
      }
    }

    // Handle AI enhancement
    if (flags['ai-enhance']) {
      try {
        jobManager.writeJobLog(this.jobId, 'Starting AI enhancement...');
        const backgroundOps = await createBackgroundOperationsManager();

        const aiJobId = await backgroundOps.processBatchInBackground(
          [
            {
              type: 'ai-enhance',
              todo,
              listName,
              operation: 'update',
            },
          ],
          'low'
        );

        jobManager.writeJobLog(this.jobId, `AI enhancement queued: ${aiJobId}`);

        // For AI enhancement, we don't wait (it's a nice-to-have)
        jobManager.writeJobLog(
          this.jobId,
          'AI enhancement processing in background'
        );
      } catch (error) {
        jobManager.writeJobLog(
          this.jobId,
          `AI enhancement warning: ${error.message}`
        );
      }
    }
  }

  updateProgress(progress, message) {
    this.currentProgress = progress;
    jobManager.updateProgress(this.jobId, progress);
    if (message) {
      jobManager.writeJobLog(this.jobId, `Progress ${progress}%: ${message}`);
    }
  }
}

// Main execution
async function main() {
  if (process.argv.length < 5) {
    console.error('Usage: background-update-worker.js <jobId> <args> <flags>');
    process.exit(1);
  }

  const jobId = process.argv[2];
  const args = process.argv[3];
  const flags = process.argv[4];

  const worker = new BackgroundUpdateWorker(jobId, args, flags);
  await worker.run();
}

// Handle uncaught errors
process.on('uncaughtException', error => {
  console.error('Uncaught exception in background worker:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection in background worker:', reason);
  process.exit(1);
});

if (require.main === module) {
  main().catch(error => {
    console.error('Background worker failed:', error);
    process.exit(1);
  });
}

module.exports = BackgroundUpdateWorker;
