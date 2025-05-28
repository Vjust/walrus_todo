# Upload Queue System

The Upload Queue System provides asynchronous, non-blocking upload functionality for Walrus storage operations. This system allows users to queue uploads in the background while continuing to use the CLI for other tasks.

## Features

### Core Functionality
- **Asynchronous Processing**: Uploads run in background without blocking the CLI
- **Persistent Queue**: Queue state persists across CLI restarts
- **Priority System**: High, medium, and low priority job scheduling
- **Retry Logic**: Automatic retry with exponential backoff for failed uploads
- **Progress Tracking**: Real-time progress monitoring and status updates
- **Notification System**: CLI notifications for upload events

### Queue Management
- **Concurrent Processing**: Configurable number of simultaneous uploads
- **Job Control**: Cancel, retry, or clear jobs
- **Status Monitoring**: Detailed queue statistics and job status
- **Cleanup**: Automatic cleanup of old completed jobs

## Usage

### Basic Queue Operations

#### Store with Queue
```bash
# Queue a single todo upload
waltodo store my-todos "Buy groceries" --queue

# Queue all todos in a list
waltodo store my-todos --queue

# Queue with high priority
waltodo store my-todos --queue --priority high

# Queue with custom retry settings
waltodo store my-todos --queue --max-retries 5
```

#### Monitor Queue Status
```bash
# Show queue overview
waltodo queue status

# List all jobs
waltodo queue list

# List only pending jobs
waltodo queue list --status pending

# Watch queue in real-time
waltodo queue watch
```

#### Queue Management
```bash
# Cancel a specific job
waltodo queue cancel job-abc123

# Retry a failed job
waltodo queue retry job-abc123

# Clear completed jobs
waltodo queue clear completed

# Clear all jobs
waltodo queue clear all
```

### Advanced Usage

#### Batch Uploads with Queue
```bash
# Queue multiple todos with different priorities
waltodo store important-todos --queue --priority high
waltodo store regular-todos --queue --priority medium
waltodo store archive-todos --queue --priority low
```

#### Queue Statistics
```bash
# View detailed statistics
waltodo queue stats
```

## Architecture

### Queue Components

#### 1. Upload Queue (`upload-queue.ts`)
The core queue system that manages job lifecycle:

```typescript
interface QueueJob {
  id: string;
  type: 'todo' | 'todo-list' | 'blob';
  data: Todo | TodoList | BlobData;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  priority: 'low' | 'medium' | 'high';
  retryCount: number;
  maxRetries: number;
  epochs: number;
  network: string;
  // ... additional metadata
}
```

**Key Methods:**
- `addTodoJob()` - Queue a todo upload
- `addTodoListJob()` - Queue a todo list upload
- `addBlobJob()` - Queue a blob upload
- `getJob()` - Get job details
- `cancelJob()` - Cancel a job
- `retryJob()` - Retry a failed job

#### 2. Queue Command (`queue.ts`)
CLI interface for queue management:

```bash
waltodo queue [action] [target] [options]
```

**Actions:**
- `status` - Show queue overview
- `list` - List jobs with filtering
- `stats` - Show detailed statistics
- `cancel` - Cancel specific job
- `retry` - Retry failed job
- `clear` - Clear jobs by status
- `watch` - Real-time monitoring

#### 3. Notification System (`notification-system.ts`)
Handles user notifications for queue events:

```typescript
interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'progress';
  title: string;
  message: string;
  timestamp: Date;
  data?: any;
}
```

### Queue Processing

#### Job Lifecycle
1. **Queued**: Job added to queue with pending status
2. **Processing**: Worker picks up job and starts upload
3. **Progress**: Regular progress updates during upload
4. **Completed**: Upload successful, blob ID stored
5. **Failed**: Upload failed after max retries

#### Worker System
- Configurable number of concurrent workers
- Rate limiting to respect Walrus network limits
- Automatic retry with exponential backoff
- Job prioritization (high > medium > low)

#### Persistence
- Queue state saved to `.waltodo-cache/upload-queue/upload-queue.json`
- Automatic recovery on CLI restart
- Processing jobs reset to pending on startup

### Configuration

#### Queue Options
```typescript
interface QueueOptions {
  maxConcurrency: number;      // Default: 3
  retryDelayMs: number;        // Default: 2000
  maxRetries: number;          // Default: 3
  persistenceDir: string;      // Default: .waltodo-cache/upload-queue
  processingTimeoutMs: number; // Default: 300000 (5 minutes)
  enableNotifications: boolean; // Default: true
}
```

#### Environment Variables
```bash
# Disable queue notifications
WALTODO_QUEUE_NOTIFICATIONS=false

# Set custom queue directory
WALTODO_QUEUE_DIR=/path/to/queue

# Set max concurrency
WALTODO_QUEUE_CONCURRENCY=5
```

## Examples

### Example 1: Simple Todo Upload
```bash
# Queue a todo upload
$ waltodo store my-todos "Complete project" --queue

📋 Queueing uploads...
  ✓ Queued: Complete project (Job: todo-abc1...)

✅ Successfully queued 1 todo(s) for upload

Queue Status:
  Pending: 1
  Processing: 0
  Completed: 0
  Failed: 0

Next Steps:
  • Monitor progress: waltodo queue status
  • Watch real-time: waltodo queue watch
  • View job details: waltodo queue list
```

### Example 2: Monitor Progress
```bash
# Watch queue in real-time
$ waltodo queue watch

📊 Watching upload queue... (Press Ctrl+C to exit)

🔄 Started: Complete project
⏳ Connecting to Walrus... (25%)
⏳ Uploading todo... (50%)
✅ Completed: Complete project -> blob-xyz789

Queue: 0⏳ 0🔄 1✅ 0❌
```

### Example 3: Batch Operations
```bash
# Queue multiple lists with different priorities
$ waltodo store urgent-tasks --queue --priority high
$ waltodo store daily-tasks --queue --priority medium
$ waltodo store someday-tasks --queue --priority low

# Check queue status
$ waltodo queue status

Upload Queue Status
Total Jobs: 3
Active: 3 (3 pending, 0 processing, 0 retrying)
Completed: 0
Failed: 0

Success Rate: 0.0%
Data Uploaded: 0 B
```

### Example 4: Error Handling
```bash
# Retry a failed job
$ waltodo queue retry job-abc123

✅ Job job-abc123 queued for retry

# Clear failed jobs
$ waltodo queue clear failed

✅ Cleared 2 job(s)
```

## Integration with Existing Commands

### Enhanced Store Command
The store command now supports queue mode with the `--queue` flag:

```bash
# Traditional synchronous upload
waltodo store my-todos

# New asynchronous queue upload
waltodo store my-todos --queue
```

### Background Compatibility
Queue mode works alongside existing background operations:

```bash
# Background mode (process-based)
waltodo store my-todos --background

# Queue mode (event-driven)
waltodo store my-todos --queue
```

## Performance Benefits

### Non-Blocking Operations
- CLI remains responsive during uploads
- Multiple commands can run while uploads process
- No waiting for large batch uploads

### Optimized Processing
- Rate limiting prevents network overload
- Retry logic handles transient failures
- Priority scheduling for important uploads

### Resource Management
- Configurable concurrency limits
- Memory-efficient job storage
- Automatic cleanup of old jobs

## Error Handling

### Retry Strategy
- Exponential backoff for failed uploads
- Configurable maximum retry count
- Detailed error logging and reporting

### Network Issues
- Automatic retry for network failures
- Rate limiting to prevent overwhelming servers
- Graceful degradation during outages

### User Control
- Cancel running jobs
- Retry failed jobs manually
- Clear failed jobs to reduce clutter

## Future Enhancements

### Planned Features
- **Desktop Notifications**: System-level notifications for completions
- **Upload Scheduling**: Schedule uploads for specific times
- **Bandwidth Limiting**: Control upload bandwidth usage
- **Queue Sharing**: Share queue status across multiple CLI instances
- **Web Dashboard**: Browser-based queue monitoring
- **Progress Estimation**: Better time remaining calculations

### Extensibility
The queue system is designed to be extensible:
- Plugin system for custom job types
- Webhook notifications for external systems
- Custom retry strategies
- Integration with external task schedulers

## Troubleshooting

### Common Issues

#### Queue Not Processing
```bash
# Check queue status
waltodo queue status

# Restart queue processing
waltodo queue clear failed
```

#### Jobs Stuck in Processing
```bash
# Reset processing jobs to pending
# (happens automatically on CLI restart)
```

#### High Memory Usage
```bash
# Clear old completed jobs
waltodo queue clear completed

# Check queue statistics
waltodo queue stats
```

### Debug Mode
```bash
# Enable verbose logging
DEBUG=waltodo:upload-queue waltodo store my-todos --queue
```

### Support
For issues with the upload queue system:
1. Check queue status: `waltodo queue status`
2. Review logs in `.waltodo-cache/upload-queue/`
3. Clear problematic jobs: `waltodo queue clear failed`
4. Restart with fresh queue if needed

The upload queue system provides a robust, user-friendly way to handle Walrus uploads asynchronously, improving the overall CLI experience while maintaining reliability and performance.