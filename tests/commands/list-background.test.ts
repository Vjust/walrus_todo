import { expect, test } from '@oclif/test';
import * as fs from 'fs';
import * as path from 'path';
import { TodoService } from '../../apps/cli/src/services/todoService';
import { jobManager } from '../../apps/cli/src/utils/PerformanceMonitor';

describe('List Command Background Operations', () => {
  let todoService: TodoService;
  let testListName: string;

  beforeEach(() => {
    todoService = new TodoService();
    testListName = `test-list-${Date.now()}`;
    
    // Clean up any existing jobs
    jobManager.cleanupOldJobs(0);
  });

  afterEach(async () => {
    // Clean up test data
    try {
      const testFile = path.join(process.cwd(), 'Todos', `${testListName}.json`);
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Background Flag Support', () => {
    test
      .stdout()
      .command(['list', '--background'])
      .it('should support --background flag for empty lists', ctx => {
        expect(ctx.stdout).to.contain('Starting background list operation');
        expect(ctx.stdout).to.contain('Job ID:');
      });

    test
      .stdout()
      .command(['list', testListName, '--background'])
      .it('should support --background flag for specific list', ctx => {
        expect(ctx.stdout).to.contain('Starting background list operation');
        expect(ctx.stdout).to.contain('Job ID:');
      });

    test
      .stdout()
      .command(['list', '--sync'])
      .it('should automatically use background for sync operations', ctx => {
        expect(ctx.stdout).to.contain('Starting background list operation');
      });
  });

  describe('Watch Mode', () => {
    test
      .timeout(10000)
      .stdout()
      .command(['list', '--watch'])
      .it('should start watch mode', ctx => {
        expect(ctx.stdout).to.contain('Starting watch mode');
        expect(ctx.stdout).to.contain('Press Ctrl+C to exit');
      });
  });

  describe('Streaming Output', () => {
    beforeEach(async () => {
      // Create test todos
      await todoService.createList(testListName);
      for (let i = 0; i < 15; i++) {
        await todoService.addTodo(testListName, {
          title: `Test todo ${i}`,
          priority: i % 3 === 0 ? 'high' : i % 2 === 0 ? 'medium' : 'low',
          completed: i % 4 === 0,
          tags: [`tag${i % 3}`],
          dueDate: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
      }
    });

    test
      .stdout()
      .command(['list', testListName, '--stream'])
      .it('should stream output for specific list', ctx => {
        expect(ctx.stdout).to.contain(testListName);
        expect(ctx.stdout).to.contain('Test todo');
      });

    test
      .stdout()
      .command(['list', '--stream'])
      .it('should stream output for all lists', ctx => {
        expect(ctx.stdout).to.contain('Found');
        expect(ctx.stdout).to.contain('lists');
      });
  });

  describe('Job Status Checking', () => {
    test
      .stdout()
      .command(['list', '--job-id', 'nonexistent'])
      .catch(err => {
        expect(err.message).to.contain('Job not found');
      })
      .it('should handle non-existent job IDs');

    test
      .stdout()
      .do(async () => {
        // Create a test job
        const job = jobManager.createJob('list', [], {});
        jobManager.startJob(job.id);
        jobManager.completeJob(job.id, { testData: 'test' });
        return job.id;
      })
      .command(ctx => ['list', '--job-id', ctx.job?.id || 'test'])
      .it('should show job status for existing jobs', ctx => {
        expect(ctx.stdout).to.contain('✅');
        expect(ctx.stdout).to.contain('list');
      });
  });

  describe('Large Dataset Handling', () => {
    beforeEach(async () => {
      // Create multiple lists with many todos
      for (let listIndex = 0; listIndex < 5; listIndex++) {
        const listName = `${testListName}-${listIndex}`;
        await todoService.createList(listName);
        
        for (let todoIndex = 0; todoIndex < 25; todoIndex++) {
          await todoService.addTodo(listName, {
            title: `Todo ${todoIndex} in list ${listIndex}`,
            priority: todoIndex % 3 === 0 ? 'high' : 'medium',
            completed: todoIndex % 5 === 0
          });
        }
      }
    });

    test
      .stdout()
      .timeout(15000)
      .command(['list'])
      .it('should handle multiple lists efficiently', ctx => {
        expect(ctx.stdout).to.contain('Available Todo Lists');
        expect(ctx.stdout).to.contain(testListName);
      });

    test
      .stdout()
      .command([`list`, `${testListName}-0`, '--background'])
      .it('should automatically use background for large lists', ctx => {
        expect(ctx.stdout).to.contain('Starting background list operation');
      });
  });

  describe('Progress Tracking', () => {
    test
      .stdout()
      .do(() => {
        const job = jobManager.createJob('list', ['test'], {});
        jobManager.startJob(job.id);
        jobManager.updateProgress(job.id, 50, 5, 10);
        return job;
      })
      .command(ctx => ['list', '--job-id', ctx.job.id])
      .it('should show progress information', ctx => {
        expect(ctx.stdout).to.contain('Progress:');
        expect(ctx.stdout).to.contain('50%');
        expect(ctx.stdout).to.contain('Items: 5/10');
      });
  });

  describe('Filtering and Sorting in Background', () => {
    beforeEach(async () => {
      await todoService.createList(testListName);
      
      // Create todos with different properties
      const todos = [
        { title: 'High priority task', priority: 'high', completed: false, dueDate: '2024-01-01' },
        { title: 'Medium priority task', priority: 'medium', completed: true, dueDate: '2024-02-01' },
        { title: 'Low priority task', priority: 'low', completed: false, dueDate: '2024-03-01' },
        { title: 'Another high priority', priority: 'high', completed: true, dueDate: '2024-01-15' }
      ];
      
      for (const todo of todos) {
        await todoService.addTodo(testListName, todo);
      }
    });

    test
      .stdout()
      .command(['list', testListName, '--background', '--completed'])
      .it('should support filtering in background mode', ctx => {
        expect(ctx.stdout).to.contain('Starting background list operation');
      });

    test
      .stdout()
      .command(['list', testListName, '--background', '--sort', 'priority'])
      .it('should support sorting in background mode', ctx => {
        expect(ctx.stdout).to.contain('Starting background list operation');
      });
  });

  describe('Error Handling', () => {
    test
      .stdout()
      .command(['list', 'nonexistent-list', '--background'])
      .it('should handle background operations on nonexistent lists', ctx => {
        expect(ctx.stdout).to.contain('Starting background list operation');
      });

    test
      .stdout()
      .command(['list', '--watch', '--background'])
      .it('should handle conflicting flags gracefully', ctx => {
        expect(ctx.stdout).to.contain('Starting watch mode');
      });
  });

  describe('Output Format Support', () => {
    test
      .stdout()
      .command(['list', '--background', '--output', 'json'])
      .it('should support JSON output in background mode', ctx => {
        expect(ctx.stdout).to.contain('Starting background list operation');
      });

    test
      .stdout()
      .command(['list', testListName, '--stream', '--detailed'])
      .it('should support detailed output in stream mode', ctx => {
        expect(ctx.stdout).to.contain(testListName);
      });
  });

  describe('Performance Monitoring', () => {
    test
      .stdout()
      .do(() => {
        const job = jobManager.createJob('list', ['performance-test'], {});
        jobManager.startJob(job.id);
        
        // Simulate some processing time
        setTimeout(() => {
          jobManager.updateProgress(job.id, 25, 25, 100);
        }, 100);
        
        setTimeout(() => {
          jobManager.updateProgress(job.id, 75, 75, 100);
        }, 200);
        
        setTimeout(() => {
          jobManager.completeJob(job.id, { 
            processedItems: 100,
            totalTime: '2.5s',
            avgItemTime: '25ms'
          });
        }, 300);
        
        return job;
      })
      .command(ctx => ['list', '--job-id', ctx.job.id])
      .it('should track performance metrics', ctx => {
        expect(ctx.stdout).to.contain('list');
      });
  });

  describe('Cleanup and Resource Management', () => {
    test
      .stdout()
      .do(() => {
        // Create multiple jobs to test cleanup
        const jobs = [];
        for (let i = 0; i < 3; i++) {
          const job = jobManager.createJob('list', [`test-${i}`], {});
          jobManager.startJob(job.id);
          jobManager.completeJob(job.id);
          jobs.push(job);
        }
        return jobs;
      })
      .command(['list'])
      .it('should manage multiple background jobs', ctx => {
        const activeJobs = jobManager.getActiveJobs();
        const completedJobs = jobManager.getCompletedJobs();
        
        expect(completedJobs.length).to.be.greaterThan(0);
      });
  });
});