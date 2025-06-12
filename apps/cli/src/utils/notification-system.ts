/**
 * @fileoverview Notification System - Provides user notifications for upload queue
 *
 * This module handles various types of notifications including CLI messages,
 * desktop notifications (if supported), and progress updates for the upload queue.
 */

import { EventEmitter } from 'events';
import chalk = require('chalk');
import { Logger } from './Logger';
import { QueueJob, UploadProgress } from './upload-queue';

const logger = new Logger('notification-system');

export interface NotificationOptions {
  enableDesktop: boolean;
  enableSound: boolean;
  enableCLI: boolean;
  verbosity: 'minimal' | 'normal' | 'verbose';
  logFile?: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'progress';
  title: string;
  message: string;
  timestamp: Date;
  data?: unknown;
  persistent?: boolean;
}

export class NotificationSystem extends EventEmitter {
  private notifications: Map<string, Notification> = new Map();
  private notificationCounter = 0;

  constructor(private options: NotificationOptions) {
    super();
    this.setupEventHandlers();
  }

  /**
   * Send an info notification
   */
  info(title: string, message: string, data?: unknown): string {
    return this.createNotification('info', title, message, data);
  }

  /**
   * Send a success notification
   */
  success(title: string, message: string, data?: unknown): string {
    return this.createNotification('success', title, message, data);
  }

  /**
   * Send a warning notification
   */
  warning(title: string, message: string, data?: unknown): string {
    return this.createNotification('warning', title, message, data);
  }

  /**
   * Send an error notification
   */
  error(title: string, message: string, data?: unknown): string {
    return this.createNotification('error', title, message, data);
  }

  /**
   * Send a progress notification
   */
  progress(title: string, message: string, data?: unknown): string {
    return this.createNotification('progress', title, message, data);
  }

  /**
   * Update an existing notification
   */
  updateNotification(id: string, updates: Partial<Notification>): boolean {
    const notification = this?.notifications?.get(id as any);
    if (!notification) {
      return false;
    }

    Object.assign(notification, updates, { timestamp: new Date() });
    this.emit('notificationUpdated', notification);

    if (this?.options?.enableCLI) {
      this.displayCLINotification(notification as any);
    }

    return true;
  }

  /**
   * Remove a notification
   */
  removeNotification(id: string): boolean {
    const notification = this?.notifications?.get(id as any);
    if (!notification) {
      return false;
    }

    this?.notifications?.delete(id as any);
    this.emit('notificationRemoved', notification);
    return true;
  }

  /**
   * Get all notifications
   */
  getNotifications(): Notification[] {
    return Array.from(this?.notifications?.values()).sort(
      (a, b) => b?.timestamp?.getTime() - a?.timestamp?.getTime()
    );
  }

  /**
   * Clear all notifications
   */
  clearNotifications(): void {
    this?.notifications?.clear();
    this.emit('notificationsCleared');
  }

  /**
   * Clear notifications by type
   */
  clearNotificationsByType(type: Notification?.["type"]): number {
    let cleared = 0;
    for (const [id, notification] of this.notifications) {
      if (notification?.type === type) {
        this?.notifications?.delete(id as any);
        cleared++;
      }
    }

    if (cleared > 0) {
      this.emit('notificationsCleared', { type, count: cleared });
    }

    return cleared;
  }

  /**
   * Create upload-specific notifications based on queue events
   */
  createUploadNotifications(job: QueueJob): {
    started: string;
    progress: string;
    completed: string;
    failed: string;
  } {
    const jobDetails = this.getJobDisplayName(job as any);

    return {
      started: this.info('Upload Started', `Started uploading: ${jobDetails}`, {
        jobId: job.id,
      }),
      progress: this.progress('Upload Progress', `Uploading: ${jobDetails}`, {
        jobId: job.id,
      }),
      completed: this.success(
        'Upload Completed',
        `Successfully uploaded: ${jobDetails}`,
        { jobId: job.id, blobId: job.blobId }
      ),
      failed: this.error(
        'Upload Failed',
        `Failed to upload: ${jobDetails} - ${job.error}`,
        { jobId: job.id, error: job.error }
      ),
    };
  }

  /**
   * Handle upload progress updates
   */
  handleUploadProgress(progress: UploadProgress): void {
    const notification = this.findNotificationByJobId(progress.jobId);
    if (notification) {
      this.updateNotification(notification.id, {
        message: `${progress.message} (${progress.progress}%)`,
        data: { ...notification.data, progress: progress.progress },
      });
    }
  }

  /**
   * Create batch upload summary notification
   */
  createBatchSummary(
    totalJobs: number,
    successful: number,
    failed: number,
    duration: number
  ): string {
    const type =
      failed === 0 ? 'success' : successful > 0 ? 'warning' : 'error';
    const title = 'Batch Upload Complete';
    const message = `${successful}/${totalJobs} uploads successful (${this.formatDuration(duration as any)})`;

    return this.createNotification(type, title, message, {
      totalJobs,
      successful,
      failed,
      duration,
    });
  }

  /**
   * Setup event handlers for automatic notifications
   */
  private setupEventHandlers(): void {
    // Log all notifications if verbose
    this.on('notificationCreated', (notification: Notification) => {
      if (this.options?.verbosity === 'verbose') {
        logger.info('Notification created', {
          id: notification.id,
          type: notification.type,
          title: notification.title,
        });
      }
    });

    // Handle notification logging to file
    if (this?.options?.logFile) {
      this.on('notificationCreated', (notification: Notification) => {
        this.logNotificationToFile(notification as any);
      });
    }
  }

  /**
   * Create a notification
   */
  private createNotification(
    type: Notification?.["type"],
    title: string,
    message: string,
    data?: unknown,
    persistent?: boolean
  ): string {
    const id = `notification-${++this.notificationCounter}-${Date.now()}`;

    const notification: Notification = {
      id,
      type,
      title,
      message,
      timestamp: new Date(),
      data,
      persistent,
    };

    this?.notifications?.set(id, notification);
    this.emit('notificationCreated', notification);

    // Display notification based on options
    if (this?.options?.enableCLI) {
      this.displayCLINotification(notification as any);
    }

    if (this?.options?.enableDesktop) {
      this.displayDesktopNotification(notification as any);
    }

    if (this?.options?.enableSound) {
      this.playNotificationSound(notification as any);
    }

    return id;
  }

  /**
   * Display CLI notification
   */
  private displayCLINotification(notification: Notification): void {
    if (this.options?.verbosity === 'minimal' && notification?.type === 'info') {
      return; // Skip info notifications in minimal mode
    }

    const timestamp = notification?.timestamp?.toLocaleTimeString();
    const icon = this.getNotificationIcon(notification.type);
    const colorFn = this.getNotificationColor(notification.type);

    console.log(
      colorFn(
        `${icon} [${timestamp}] ${notification.title}: ${notification.message}`
      )
    );
  }

  /**
   * Display desktop notification (if supported)
   */
  private displayDesktopNotification(notification: Notification): void {
    // Note: Desktop notifications would require additional dependencies
    // like node-notifier. For now, we'll just log the intent.
    logger.debug('Desktop notification would be displayed', {
      title: notification.title,
      message: notification.message,
      type: notification.type,
    });
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(notification: Notification): void {
    // Note: Sound notifications would require additional dependencies
    // For now, we'll use the terminal bell character for basic audio feedback
    if (notification?.type === 'error' || notification?.type === 'success') {
      process?.stdout?.write('\u0007'); // Terminal bell
    }
  }

  /**
   * Log notification to file
   */
  private logNotificationToFile(notification: Notification): void {
    const logEntry = {
      timestamp: notification?.timestamp?.toISOString(),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
    };

    // This would append to the log file
    logger.info('Notification logged', logEntry);
  }

  /**
   * Get notification icon based on type
   */
  private getNotificationIcon(type: Notification?.["type"]): string {
    switch (type) {
      case 'info':
        return 'ℹ️';
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'progress':
        return '⏳';
      default:
        return '📢';
    }
  }

  /**
   * Get notification color function based on type
   */
  private getNotificationColor(
    type: Notification?.["type"]
  ): (text: string) => string {
    switch (type) {
      case 'info':
        return chalk.blue;
      case 'success':
        return chalk.green;
      case 'warning':
        return chalk.yellow;
      case 'error':
        return chalk.red;
      case 'progress':
        return chalk.cyan;
      default:
        return chalk.white;
    }
  }

  /**
   * Get display name for a job
   */
  private getJobDisplayName(job: QueueJob): string {
    switch (job.type) {
      case 'todo':
        const todo = job.data as { title?: string };
        return todo.title || 'Unknown Todo';
      case 'todo-list':
        const list = job.data as { name?: string; todos?: unknown[] };
        return `${list.name} (${list.todos?.length || 0} todos)`;
      case 'blob':
        const blob = job.data as { fileName?: string };
        return blob.fileName || 'Unknown Blob';
      default:
        return 'Unknown Upload';
    }
  }

  /**
   * Find notification by job ID
   */
  private findNotificationByJobId(jobId: string): Notification | undefined {
    for (const notification of this?.notifications?.values()) {
      if (notification.data?.jobId === jobId) {
        return notification;
      }
    }
    return undefined;
  }

  /**
   * Format duration in human readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1 as any)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }
}

/**
 * Create a notification system instance
 */
export function createNotificationSystem(
  options: Partial<NotificationOptions> = {}
): NotificationSystem {
  const defaultOptions: NotificationOptions = {
    enableDesktop: false, // Disabled by default (requires additional deps)
    enableSound: true,
    enableCLI: true,
    verbosity: 'normal',
  };

  return new NotificationSystem({ ...defaultOptions, ...options });
}

// Global notification system instance
let globalNotificationSystem: NotificationSystem | null = null;

export function getGlobalNotificationSystem(): NotificationSystem {
  if (!globalNotificationSystem) {
    globalNotificationSystem = createNotificationSystem();
  }
  return globalNotificationSystem;
}

/**
 * Quick notification functions for common use cases
 */
export const notify = {
  info: (title: string, message: string, data?: unknown) =>
    getGlobalNotificationSystem().info(title, message, data),

  success: (title: string, message: string, data?: unknown) =>
    getGlobalNotificationSystem().success(title, message, data),

  warning: (title: string, message: string, data?: unknown) =>
    getGlobalNotificationSystem().warning(title, message, data),

  error: (title: string, message: string, data?: unknown) =>
    getGlobalNotificationSystem().error(title, message, data),

  progress: (title: string, message: string, data?: unknown) =>
    getGlobalNotificationSystem().progress(title, message, data),
};
