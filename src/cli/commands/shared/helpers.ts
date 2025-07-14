/**
 * Shared helper functions for CLI commands
 * These utilities are used across multiple command modules
 */

import { BlobManager } from '../../../storage/blob-manager';
import { WalrusClient } from '../../../storage/walrus';
import { getConfig } from '../../../config';
import { Todo } from '../../../models/todo';
import { createTodo, markTodoAsDone } from '../../../todos/operations';
import { PublishedBlob } from '../../../models/blob';
import { BlobUtils, BlobStatus } from '../../../models/blob';
import Table from 'cli-table3';
import chalk from 'chalk';

/**
 * Helper function to create blob manager instance
 */
export async function createBlobManager(): Promise<BlobManager> {
  const config = await getConfig();
  const walrusClient = new WalrusClient(config.walrus);
  
  // Convert config to PublishConfig format
  const publishConfig = {
    defaultEpochs: config.blobs.publish.defaultEpochs,
    defaultDeletable: config.blobs.publish.defaultDeletable,
    maxBlobSize: config.blobs.publish.maxBlobSize,
    enableCompression: config.blobs.publish.enableCompression,
    enableEncryption: config.blobs.publish.enableEncryption,
    defaultTags: config.blobs.publish.defaultTags,
  };
  
  return new BlobManager(walrusClient, undefined, publishConfig);
}

/**
 * Helper function to import a TODO with full metadata
 */
export async function importTodo(todo: Todo): Promise<Todo> {
  // Create basic TODO first
  const createdTodo = await createTodo(todo.description, {
    priority: todo.priority,
    tags: todo.tags,
    dueDate: todo.dueDate ? new Date(todo.dueDate).toISOString() : undefined,
  });
  
  // If the TODO is completed, mark it as done
  if (todo.status === 'done' && todo.completedAt) {
    await markTodoAsDone(createdTodo.id);
  }
  
  return createdTodo;
}

/**
 * Helper function to create blob table
 */
export function createBlobTable(blobs: PublishedBlob[]): string {
  const table = new Table({
    head: ['Blob ID', 'TODOs', 'Status', 'Published', 'Size', 'Cost'],
    colWidths: [16, 8, 10, 12, 10, 12],
    style: {
      head: ['cyan'],
      border: ['grey']
    }
  });

  blobs.forEach(blob => {
    const statusColor = blob.status === BlobStatus.ACTIVE ? 'green' : 
                       blob.status === BlobStatus.EXPIRED ? 'yellow' : 'red';
    
    table.push([
      BlobUtils.shortBlobId(blob.id, 14),
      blob.todoCount.toString(),
      chalk[statusColor](blob.status),
      new Date(blob.publishedAt).toLocaleDateString(),
      BlobUtils.formatSize(blob.size),
      BlobUtils.formatCost(blob.cost)
    ]);
  });

  return table.toString();
}