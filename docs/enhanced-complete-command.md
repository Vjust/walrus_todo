# Enhanced Complete Command - Background Operations Guide

The `complete` command has been enhanced with background operation support, making it non-blocking and perfect for large-scale todo completion operations.

## New Features

### 🚀 Background Execution
Run completion operations in the background without locking the terminal.

```bash
# Complete a single todo in background
waltodo complete todo-123 --background

# Complete specific todo from a list in background
waltodo complete mylist todo-456 --background
```

### 📦 Batch Completion
Complete multiple todos in parallel with progress tracking.

```bash
# Complete all todos in a list
waltodo complete --batch --list work

# Custom batch size for parallel processing
waltodo complete --batch --batchSize 10 --list personal
```

### 🔄 Combined Background + Batch
Process large numbers of todos in the background.

```bash
# Background batch completion of all todos in a list
waltodo complete --batch --list work --background

# Background batch with custom settings
waltodo complete --batch --batchSize 5 --list personal --background --network testnet
```

## Job Management

### View Background Jobs
```bash
# List all background jobs
waltodo jobs

# Show only active jobs
waltodo jobs --active

# Show only completed jobs
waltodo jobs --completed

# Show failed jobs
waltodo jobs --failed
```

### Monitor Job Progress
```bash
# Check detailed status of a specific job
waltodo status job_123456

# Follow job progress in real-time
waltodo status job_123456 --follow

# Include full logs
waltodo status job_123456 --logs
```

### Cancel Background Operations
```bash
# Cancel a specific job
waltodo cancel job_123456

# Cancel all active jobs
waltodo cancel --all

# Cancel all jobs of a specific type
waltodo cancel --type complete
```

## Technical Implementation

### Background Process Management
- Uses Node.js `spawn()` to create detached background processes
- Prevents infinite recursion with environment variable checks
- Proper process cleanup and resource management

### Progress Tracking
- Real-time progress updates for batch operations
- Item-by-item completion tracking
- Detailed logging of all operations

### Error Handling
- Graceful failure handling for individual todos
- Partial completion support (some succeed, some fail)
- Comprehensive error reporting and logging

### Storage Synchronization
- Non-blocking blockchain operations
- Concurrent Walrus storage updates
- Retry logic with exponential backoff

## Command Examples

### Single Todo Completion
```bash
# Foreground (traditional)
waltodo complete "Buy groceries"

# Background
waltodo complete "Buy groceries" --background

# With specific network
waltodo complete work "Finish report" --background --network testnet
```

### Batch Operations
```bash
# Complete all todos in default list
waltodo complete --batch

# Complete all todos in specific list
waltodo complete --batch --list work

# Background batch with progress tracking
waltodo complete --batch --list personal --background

# Custom batch size for performance tuning
waltodo complete --batch --batchSize 3 --list urgent
```

### Job Management Workflow
```bash
# 1. Start a background batch operation
waltodo complete --batch --list work --background
# Output: 🚀 Started background batch completion job: job_1234567890_abc123

# 2. Check job status
waltodo status job_1234567890_abc123

# 3. Follow progress in real-time
waltodo status job_1234567890_abc123 --follow

# 4. View all jobs
waltodo jobs

# 5. Cancel if needed
waltodo cancel job_1234567890_abc123
```

## Performance Considerations

### Batch Size Optimization
- Default batch size: 5 concurrent operations
- Adjust based on network conditions and system resources
- Range: 1-20 parallel operations

### Memory Management
- Background processes are detached and don't inherit parent memory
- Automatic cleanup of completed job logs (after 7 days)
- Resource-efficient progress tracking

### Network Resilience
- Automatic retry logic for blockchain operations
- Timeout handling for Walrus storage
- Graceful degradation when services are unavailable

## Error Scenarios and Recovery

### Partial Completion
When batch operations encounter errors, successful completions are preserved:

```bash
✅ Batch completion finished:
  Completed: 8
  Failed: 2

Errors:
  • "Update server config": Network timeout after 30 seconds
  • "Deploy to production": NFT validation failed
```

### Background Job Failures
Failed background jobs retain logs for debugging:

```bash
# Check failed job details
waltodo status failed_job_id --logs

# View recent failed jobs
waltodo jobs --failed
```

### Recovery Strategies
1. **Retry Individual Failures**: Complete failed todos manually
2. **Restart Background Jobs**: Cancel and restart with different settings
3. **Adjust Batch Size**: Reduce concurrency for unstable networks
4. **Use Foreground Mode**: Switch to traditional mode for debugging

## Best Practices

### When to Use Background Mode
- ✅ Large batch operations (>10 todos)
- ✅ Network-dependent operations (blockchain/Walrus)
- ✅ Long-running completion workflows
- ❌ Single todo completion (usually unnecessary)
- ❌ When you need immediate feedback

### Batch Size Guidelines
- **1-3**: Slow networks or limited resources
- **5**: Default, good for most situations
- **10-15**: Fast networks and powerful systems
- **20**: Maximum, only for local testing

### Monitoring and Maintenance
```bash
# Daily cleanup routine
waltodo jobs --cleanup

# Check system health
waltodo jobs --active
waltodo jobs --failed

# Performance monitoring
waltodo jobs --completed | head -20
```

## Integration with Other Commands

The enhanced complete command works seamlessly with other CLI features:

```bash
# Complete todos suggested by AI
waltodo suggest --list work | head -5 | xargs -I {} waltodo complete {} --background

# Batch complete todos by priority
waltodo list --filter "priority:high" --list work | waltodo complete --batch --background

# Complete and then sync
waltodo complete todo-123 --background && waltodo sync
```

## Troubleshooting

### Common Issues

1. **Background Job Not Starting**
   ```bash
   # Check if CLI is properly installed
   which waltodo
   
   # Verify permissions
   ls -la $(which waltodo)
   ```

2. **Jobs Hanging**
   ```bash
   # Cancel stuck jobs
   waltodo cancel --all
   
   # Check system resources
   waltodo jobs --active
   ```

3. **Progress Not Updating**
   ```bash
   # Check job logs
   waltodo status job_id --logs
   
   # Restart with verbose logging
   waltodo complete --batch --list work --background --verbose
   ```

### Debug Mode
Enable detailed logging for troubleshooting:

```bash
# Background operation with debug info
waltodo complete --batch --list work --background --debug

# Follow debug logs
waltodo status job_id --follow --logs
```

## Conclusion

The enhanced complete command transforms todo completion from a blocking operation into a flexible, scalable background process. Use it for:

- 🔄 **Batch Operations**: Complete multiple todos efficiently
- ⚡ **Non-blocking Workflows**: Continue working while todos complete
- 📊 **Progress Monitoring**: Track completion status in real-time
- 🛠️ **Error Recovery**: Handle failures gracefully with detailed logging

This enhancement makes the CLI suitable for production workflows and large-scale todo management scenarios.