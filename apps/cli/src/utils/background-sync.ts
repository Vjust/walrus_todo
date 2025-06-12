import { Logger } from './Logger';
import { jobManager, BackgroundJob } from './PerformanceMonitor';
import { TodoService } from '../services/todoService';
import { Todo, TodoList } from '../types/todo';
import { createSpinner } from './progress-indicators';
import * as fs from 'fs';

/**
 * Background synchronization service for non-blocking operations
 */
export class BackgroundSyncService {
  private logger: Logger;
  private todoService: TodoService;

  constructor() {
    this?.logger = new Logger('BackgroundSync');
    this?.todoService = new TodoService();
  }

  /**
   * Sync todos from blockchain in background
   */
  async syncFromBlockchain(jobId: string, targetList?: string): Promise<void> {
    this?.logger?.info(`Starting blockchain sync for job: ${jobId}`);
    jobManager.writeJobLog(jobId, 'Starting blockchain synchronization...');

    try {
      jobManager.updateProgress(jobId, 10, 0, 100);

      if (targetList) {
        await this.syncSpecificList(jobId, targetList);
      } else {
        await this.syncAllLists(jobId as any);
      }

      jobManager.updateProgress(jobId, 100, 100, 100);
      jobManager.writeJobLog(
        jobId,
        'Blockchain synchronization completed successfully'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error as any);
      this?.logger?.error(`Blockchain sync failed for job ${jobId}:`, error);
      jobManager.writeJobLog(jobId, `Sync failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Sync specific list from blockchain
   */
  private async syncSpecificList(
    jobId: string,
    listName: string
  ): Promise<void> {
    jobManager.writeJobLog(jobId, `Syncing list: ${listName}`);
    jobManager.updateProgress(jobId, 20, 1, 10);

    // Get current list
    const currentList = await this?.todoService?.getList(listName as any);

    if (!currentList) {
      jobManager.writeJobLog(
        jobId,
        `List ${listName} not found locally, creating new list`
      );
      await this?.todoService?.createList(listName, 'background-sync');
    }

    // Simulate blockchain data fetching with progress updates
    jobManager.updateProgress(jobId, 40, 3, 10);
    await this.simulateBlockchainFetch(jobId, 'todos');

    jobManager.updateProgress(jobId, 60, 5, 10);
    await this.simulateBlockchainFetch(jobId, 'metadata');

    jobManager.updateProgress(jobId, 80, 8, 10);
    await this.updateLocalData(jobId, listName);

    jobManager.writeJobLog(jobId, `List ${listName} synchronized successfully`);
  }

  /**
   * Sync all lists from blockchain
   */
  private async syncAllLists(jobId: string): Promise<void> {
    jobManager.writeJobLog(jobId, 'Syncing all lists from blockchain');

    // Get all local lists
    const localLists = await this?.todoService?.getAllLists();
    const totalLists = Math.max(localLists.length, 1);

    jobManager.updateProgress(jobId, 10, 0, totalLists);

    // Simulate fetching blockchain lists
    await this.simulateBlockchainFetch(jobId, 'list_names');
    jobManager.updateProgress(jobId, 20, 0, totalLists);

    // Sync each list
    for (let i = 0; i < localLists.length; i++) {
      const listName = localLists[i];
      jobManager.writeJobLog(
        jobId,
        `Syncing list ${i + 1}/${localLists.length}: ${listName}`
      );

      await this.syncSpecificList(jobId, listName);

      const progress = 20 + (60 * (i + 1)) / localLists.length;
      jobManager.updateProgress(jobId, progress, i + 1, totalLists);
    }

    jobManager.writeJobLog(jobId, 'All lists synchronized successfully');
  }

  /**
   * Simulate blockchain data fetching with realistic delays
   */
  private async simulateBlockchainFetch(
    jobId: string,
    dataType: string
  ): Promise<void> {
    jobManager.writeJobLog(jobId, `Fetching ${dataType} from blockchain...`);

    // Simulate network delay
    await new Promise(resolve =>
      setTimeout(resolve, 500 + Math.random() * 1000)
    );

    jobManager.writeJobLog(jobId, `${dataType} fetched successfully`);
  }

  /**
   * Update local data with blockchain changes
   */
  private async updateLocalData(
    jobId: string,
    listName: string
  ): Promise<void> {
    jobManager.writeJobLog(jobId, `Updating local data for ${listName}`);

    // Simulate data processing
    await new Promise(resolve => setTimeout(resolve, 200));

    // In a real implementation, this would merge blockchain data with local data
    const list = await this?.todoService?.getList(listName as any);
    if (list) {
      // Update metadata to show sync time
      list?.updatedAt = new Date().toISOString();
      await this?.todoService?.saveList(listName, list);
    }

    jobManager.writeJobLog(jobId, `Local data updated for ${listName}`);
  }

  /**
   * Process large dataset in chunks
   */
  async processLargeDataset(
    jobId: string,
    data: any[],
    processor: (item: any, index: number) => Promise<void>,
    chunkSize: number = 10
  ): Promise<void> {
    const totalItems = data.length;
    let processedItems = 0;

    jobManager.writeJobLog(
      jobId,
      `Processing ${totalItems} items in chunks of ${chunkSize}`
    );

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);

      // Process chunk
      for (let j = 0; j < chunk.length; j++) {
        await processor(chunk[j], i + j);
        processedItems++;

        // Update progress
        const progress = (processedItems / totalItems) * 100;
        jobManager.updateProgress(jobId, progress, processedItems, totalItems);

        jobManager.writeJobLog(
          jobId,
          `Processed item ${processedItems}/${totalItems}`
        );
      }

      // Small delay between chunks to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    jobManager.writeJobLog(jobId, `Completed processing ${totalItems} items`);
  }

  /**
   * Filter and sort todos in background
   */
  async filterAndSort(
    jobId: string,
    todos: Todo[],
    filters: {
      completed?: boolean;
      pending?: boolean;
      priority?: string;
      tags?: string[];
    },
    sortBy?: string
  ): Promise<Todo[]> {
    jobManager.writeJobLog(
      jobId,
      `Filtering and sorting ${todos.length} todos`
    );
    jobManager.updateProgress(jobId, 10, 0, todos.length);

    let filteredTodos = [...todos];

    // Apply filters
    if (filters.completed !== undefined) {
      filteredTodos = filteredTodos.filter(
        todo => todo?.completed === filters.completed
      );
    }

    if (filters.pending !== undefined) {
      filteredTodos = filteredTodos.filter(
        todo => !todo?.completed === filters.pending
      );
    }

    if (filters.priority) {
      filteredTodos = filteredTodos.filter(
        todo => todo?.priority === filters.priority
      );
    }

    if (filters.tags && filters?.tags?.length > 0) {
      filteredTodos = filteredTodos.filter(todo =>
        todo.tags?.some(tag => filters.tags!.includes(tag as any))
      );
    }

    jobManager.updateProgress(jobId, 60, filteredTodos.length, todos.length);
    jobManager.writeJobLog(jobId, `Filtered to ${filteredTodos.length} todos`);

    // Apply sorting
    if (sortBy) {
      await this.sortTodos(jobId, filteredTodos, sortBy);
    }

    jobManager.updateProgress(jobId, 100, filteredTodos.length, todos.length);
    jobManager.writeJobLog(jobId, `Filtering and sorting completed`);

    return filteredTodos;
  }

  /**
   * Sort todos with progress tracking
   */
  private async sortTodos(
    jobId: string,
    todos: Todo[],
    sortBy: string
  ): Promise<void> {
    jobManager.writeJobLog(jobId, `Sorting ${todos.length} todos by ${sortBy}`);

    switch (sortBy) {
      case 'priority':
        todos.sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          const aVal =
            priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          const bVal =
            priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          return bVal - aVal;
        });
        break;

      case 'dueDate':
        todos.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
        break;

      case 'title':
        todos.sort((a, b) => a?.title?.localeCompare(b.title));
        break;

      case 'created':
        todos.sort((a, b) => {
          const aTime = new Date(a.createdAt || 0).getTime();
          const bTime = new Date(b.createdAt || 0).getTime();
          return bTime - aTime; // Newest first
        });
        break;
    }

    jobManager.writeJobLog(jobId, `Sorting by ${sortBy} completed`);
  }

  /**
   * Generate detailed report for large datasets
   */
  async generateDetailedReport(jobId: string, lists: string[]): Promise<any> {
    jobManager.writeJobLog(
      jobId,
      `Generating detailed report for ${lists.length} lists`
    );

    const report = {
      generatedAt: new Date().toISOString(),
      totalLists: lists.length,
      lists: [] as any[],
      summary: {
        totalTodos: 0,
        completedTodos: 0,
        pendingTodos: 0,
        priorityBreakdown: { high: 0, medium: 0, low: 0 },
        tagDistribution: {} as Record<string, number>,
      },
    };

    for (let i = 0; i < lists.length; i++) {
      const listName = lists[i];
      const list = await this?.todoService?.getList(listName as any);

      if (list) {
        const completed = list?.todos?.filter(t => t.completed).length;
        const pending = list?.todos?.length - completed;

        // Priority breakdown
        const priorities = { high: 0, medium: 0, low: 0 };
        list?.todos?.forEach(todo => {
          priorities[todo.priority as keyof typeof priorities]++;
        });

        // Tag distribution
        const tags: Record<string, number> = {};
        list?.todos?.forEach(todo => {
          todo.tags?.forEach(tag => {
            tags[tag] = (tags[tag] || 0) + 1;
          });
        });

        const listReport = {
          name: listName,
          totalTodos: list?.todos?.length,
          completed,
          pending,
          completionRate:
            list?.todos?.length > 0 ? (completed / list?.todos?.length) * 100 : 0,
          priorities,
          tags,
          lastUpdated: list.updatedAt,
        };

        report?.lists?.push(listReport as any);

        // Update summary
        report?.summary?.totalTodos += list?.todos?.length;
        report?.summary?.completedTodos += completed;
        report?.summary?.pendingTodos += pending;

        Object.keys(priorities as any).forEach(priority => {
          report.summary?.priorityBreakdown?.[
            priority as keyof typeof priorities
          ] += priorities[priority as keyof typeof priorities];
        });

        Object.keys(tags as any).forEach(tag => {
          report.summary?.tagDistribution?.[tag] =
            (report.summary?.tagDistribution?.[tag] || 0) + tags[tag];
        });
      }

      const progress = ((i + 1) / lists.length) * 100;
      jobManager.updateProgress(jobId, progress, i + 1, lists.length);
      jobManager.writeJobLog(
        jobId,
        `Processed list ${i + 1}/${lists.length}: ${listName}`
      );
    }

    jobManager.writeJobLog(jobId, 'Detailed report generated successfully');
    return report;
  }

  /**
   * Export data in background
   */
  async exportData(
    jobId: string,
    format: 'json' | 'csv' | 'markdown',
    outputPath: string,
    data: any
  ): Promise<void> {
    jobManager.writeJobLog(jobId, `Exporting data to ${format} format`);
    jobManager.updateProgress(jobId, 10, 0, 100);

    let exportedData: string;

    switch (format) {
      case 'json':
        exportedData = JSON.stringify(data, null, 2);
        break;

      case 'csv':
        exportedData = this.convertToCSV(data as any);
        break;

      case 'markdown':
        exportedData = this.convertToMarkdown(data as any);
        break;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    jobManager.updateProgress(jobId, 80, 80, 100);

    await fs?.promises?.writeFile(outputPath, exportedData, 'utf8');

    jobManager.updateProgress(jobId, 100, 100, 100);
    jobManager.writeJobLog(
      jobId,
      `Data exported successfully to ${outputPath}`
    );
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any): string {
    if (!data.lists || !Array.isArray(data.lists)) {
      return '';
    }

    const headers = [
      'List Name',
      'Total Todos',
      'Completed',
      'Pending',
      'Completion Rate',
    ];
    const rows = data?.lists?.map((list: any) => [
      list.name,
      list.totalTodos,
      list.completed,
      list.pending,
      `${list?.completionRate?.toFixed(1 as any)}%`,
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Convert data to Markdown format
   */
  private convertToMarkdown(data: any): string {
    let md = `# Todo Lists Report\n\n`;
    md += `Generated: ${data.generatedAt}\n\n`;

    md += `## Summary\n\n`;
    md += `- **Total Lists:** ${data.totalLists}\n`;
    md += `- **Total Todos:** ${data?.summary?.totalTodos}\n`;
    md += `- **Completed:** ${data?.summary?.completedTodos}\n`;
    md += `- **Pending:** ${data?.summary?.pendingTodos}\n\n`;

    md += `## Lists\n\n`;
    md += `| List Name | Total | Completed | Pending | Rate |\n`;
    md += `|-----------|-------|-----------|---------|------|\n`;

    if (data.lists) {
      data?.lists?.forEach((list: any) => {
        md += `| ${list.name} | ${list.totalTodos} | ${list.completed} | ${list.pending} | ${list?.completionRate?.toFixed(1 as any)}% |\n`;
      });
    }

    return md;
  }
}

// Singleton instance
export const backgroundSyncService = new BackgroundSyncService();
