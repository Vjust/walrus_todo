# Background Retrieval Operations Demo

This document demonstrates the new background retrieval capabilities for the `retrieve` and `fetch` commands, allowing non-blocking data downloads from Walrus and Sui blockchain.

## Overview

The enhanced retrieve and fetch commands now support:
- **Background operations** that don't block the terminal
- **Progress tracking** for large data transfers  
- **Job management** with status monitoring
- **Blob verification** during background downloads
- **Parallel batch processing** for multiple items

## Background Flags

### New Flags Available:

- `--background` / `-b`: Run operation in background without blocking terminal
- `--wait` / `-w`: Wait for background operation to complete and show progress
- `--job-id <id>`: Custom job ID for tracking (optional, auto-generated if not provided)
- `--timeout <seconds>`: Timeout for operation (default: 300 seconds)
- `--progress-interval <seconds>`: Progress update interval (fetch only, default: 5 seconds)

## Basic Usage Examples

### 1. Simple Background Retrieval

```bash
# Start background retrieval and return immediately
waltodo retrieve mylist --background

# Output:
# 🚀 Starting background retrieval operation...
# Job ID: job_1703123456_abc123
# Timeout: 300s
# ✓ Background retrieval started
# 
# 💡 Track progress: waltodo jobs
# 💡 Check status: waltodo status job_1703123456_abc123
# 💡 Cancel job: waltodo cancel job_1703123456_abc123
```

### 2. Background Retrieval with Progress Monitoring

```bash
# Start background retrieval and wait for completion with progress
waltodo retrieve QmXyz123 --background --wait

# Output:
# 🚀 Starting background retrieval operation...
# Job ID: job_1703123456_def456
# Timeout: 300s
# ⏳ Waiting for retrieval to complete...
# [████████████████████] 100% - Finalizing...
# ✓ Background retrieval completed
# Items retrieved: 1
# 
# 📊 Retrieval Summary
# ──────────────────────────────
# Job ID: job_1703123456_def456
# Status: ✓ Completed
# Duration: 2.3s
# Items Retrieved: 1
```

### 3. Background Fetch with Custom Settings

```bash
# Fetch with custom timeout and progress interval
waltodo fetch 0x123abc --background --wait --timeout 600 --progress-interval 2

# Output shows progress every 2 seconds:
# [██████████░░░░░░░░░░] 50% - Retrieving data...
# [████████████████████] 100% - Finalizing...
```

## Advanced Usage Examples

### 4. Large Blob Download (Background)

```bash
# Download large blob in background without blocking
waltodo retrieve QmLargeDataBlob123 --background --list production

# Check progress later
waltodo jobs --active

# Or monitor specific job
waltodo status job_1703123456_xyz789
```

### 5. NFT Data Retrieval with Background Processing

```bash
# Retrieve NFT data in background from specific network
waltodo fetch 0x456def789abc --background --network testnet --wait

# With custom job ID for tracking
waltodo fetch 0x789ghi --background --job-id my-nft-download --list archive
```

### 6. Background Retrieval with Error Handling

```bash
# If the operation fails, you can check the logs
waltodo retrieve InvalidBlobId --background --wait

# Output:
# 🚀 Starting background retrieval operation...
# ⏳ Waiting for retrieval to complete...
# ✗ Background retrieval failed: Todo not found with blob ID 'InvalidBlobId'
# 
# Check detailed logs:
waltodo status job_1703123456_error --verbose
```

## Job Management

### Tracking Background Operations

```bash
# List all background jobs
waltodo jobs

# List only active jobs
waltodo jobs --active

# List completed jobs
waltodo jobs --completed

# List failed jobs
waltodo jobs --failed
```

### Example Jobs Output

```
Active Background Jobs                    Found 2 job(s)

🔄 RUNNING (2)
────────────────────────────────────────────────────────────
job_1703123456_abc123 - retrieve mylist
  [███████████████░░░░] 75% | 45.2s
  Items: 3/4

job_1703123457_def456 - fetch QmXyz789
  [█████████░░░░░░░░░░░] 45% | 12.1s
  
📊 Summary
──────────────────
Total: 2
Running: 2
```

### Job Status Details

```bash
# Get detailed status of specific job
waltodo status job_1703123456_abc123

# Output:
# 📊 Job Status: job_1703123456_abc123
# ─────────────────────────────────────
# Command: retrieve mylist
# Status: 🔄 Running
# Progress: 75%
# Duration: 45.2s
# Items: 3/4 processed
# Started: 2023-12-21 10:30:15
# 
# Recent Logs:
# [10:30:15] Starting retrieval operation
# [10:30:16] Connected to Walrus storage
# [10:30:18] Retrieved item 1/4: "Buy groceries"
# [10:30:22] Retrieved item 2/4: "Walk the dog"
# [10:30:28] Retrieved item 3/4: "Pay bills"
# [10:30:32] Retrieving item 4/4: "Schedule meeting"
```

### Cancelling Background Jobs

```bash
# Cancel a running job
waltodo cancel job_1703123456_abc123

# Output:
# ✓ Background job cancelled: job_1703123456_abc123
```

## Performance Features

### 1. Chunked Downloads for Large Data

The background retriever automatically handles large data transfers by:
- Breaking downloads into manageable chunks
- Providing progress updates for each chunk
- Resuming failed chunks without restarting the entire download

### 2. Parallel Processing

For multiple items:
```bash
# Background batch retrieval (automatic when retrieving lists)
waltodo retrieve production-todos --background --wait

# Shows progress for multiple items:
# [████████████████████] 100% - Item 8/8 completed
# Items retrieved: 8
# Total size: 2.4 MB
# Duration: 23.1s
```

### 3. Smart Resource Management

- Automatic resource cleanup after completion
- Memory-efficient streaming for large transfers
- Network retry logic with exponential backoff
- CPU usage monitoring and throttling

## Error Recovery and Resilience

### Network Error Handling

```bash
# Background operations automatically retry on network errors
waltodo retrieve QmNetworkTest --background --wait --timeout 600

# Output shows retry attempts:
# [██████░░░░░░░░░░░░░░] 30% - Retrying connection (attempt 2/3)...
# [████████████████████] 100% - Retrieval completed after retry
```

### Partial Success Handling

For batch operations, the system handles partial failures gracefully:

```bash
# If some items in a list fail to retrieve
waltodo retrieve mixed-todos --background --wait

# Output:
# ✓ Background retrieval completed (partial)
# Items retrieved: 6/8 (2 failed)
# Failed items logged for review
# 
# 📊 Retrieval Summary
# ──────────────────────────────
# Status: ✓ Completed (with warnings)
# Success Rate: 75% (6/8)
# Failed Items: 2
```

## Configuration and Tuning

### Environment Variables

```bash
# Tune background operation defaults
export WALTODO_BACKGROUND_TIMEOUT=600        # Default timeout (seconds)
export WALTODO_BACKGROUND_CHUNK_SIZE=5       # Items per batch
export WALTODO_BACKGROUND_RETRY_ATTEMPTS=5   # Retry attempts
export WALTODO_BACKGROUND_PROGRESS_INTERVAL=3 # Progress update interval
```

### Performance Tuning

```bash
# For large datasets, increase chunk size
waltodo retrieve large-dataset --background --chunk-size 10

# For slower networks, increase timeout
waltodo fetch 0x123 --background --timeout 900

# For faster feedback, decrease progress interval
waltodo retrieve mylist --background --wait --progress-interval 1
```

## Integration with Blockchain Events

Background operations can be triggered by blockchain events:

```bash
# Monitor for new NFTs and auto-retrieve in background
waltodo monitor --events nft-created --auto-retrieve --background

# Bulk sync operation in background
waltodo sync --from-block 1000000 --background --wait
```

## Cleanup and Maintenance

### Automatic Cleanup

```bash
# Clean up old completed jobs (automatic, but can be manual)
waltodo jobs --cleanup

# Clean up jobs older than 24 hours
waltodo jobs --cleanup --max-age 1
```

### Storage Management

Background operations store temporary data that is automatically cleaned up:
- Progress status: Kept for 1 hour after completion
- Job logs: Kept for 7 days
- Result cache: Kept for 1 hour for quick re-access

## Best Practices

### 1. Use Background for Large Operations
```bash
# ✅ Good: Large list retrieval in background
waltodo retrieve large-production-list --background

# ❌ Avoid: Small single item in background (unnecessary overhead)
waltodo retrieve QmSmallItem --background  # Better without --background
```

### 2. Monitor Long-Running Operations
```bash
# ✅ Good: Monitor progress for long operations
waltodo retrieve massive-dataset --background --wait

# ✅ Good: Check status periodically for fire-and-forget operations
waltodo retrieve dataset --background
# ... do other work ...
waltodo jobs --active  # Check later
```

### 3. Use Appropriate Timeouts
```bash
# ✅ Good: Longer timeout for large data
waltodo retrieve 10GB-dataset --background --timeout 3600

# ✅ Good: Shorter timeout for small operations
waltodo fetch QmSmallBlob --background --timeout 120
```

### 4. Handle Errors Gracefully
```bash
# ✅ Good: Check job status for error details
if waltodo retrieve unstable-source --background --job-id my-job; then
    waltodo status my-job --wait
else
    echo "Failed to start background job"
fi
```

This background retrieval system provides a robust, non-blocking way to handle large data downloads while maintaining full visibility and control over the process.