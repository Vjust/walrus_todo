# Batch Upload Guide

The WalTodo CLI now supports efficient batch processing for uploading multiple todos to Walrus storage. This feature provides significant performance improvements when storing multiple todos at once.

## Overview

The batch upload feature allows you to:
- Upload all todos in a list to Walrus storage simultaneously
- Process uploads concurrently for better performance
- Cache uploads to avoid re-uploading identical content
- Track progress with a visual progress bar
- Get detailed statistics on upload results

## Basic Usage

### Upload All Todos in a List

```bash
# Upload all todos in the default list
waltodo store --all

# Upload all todos in a specific list
waltodo store --all --list my-todos
```

### Configure Batch Size

The default batch size is 5 concurrent uploads. You can adjust this based on your network connection and system resources:

```bash
# Upload with 10 concurrent connections
waltodo store --all --list my-todos --batch-size 10

# Conservative batch size for slower connections
waltodo store --all --list my-todos --batch-size 2
```

### Examples

```bash
# Basic batch upload
waltodo store --all --list shopping

# High-performance upload (up to 20 concurrent)
waltodo store --all --list tasks --batch-size 20

# Upload to mainnet with custom epochs
waltodo store --all --list important --network mainnet --epochs 10

# Test with mock mode
waltodo store --all --list test --mock
```

## Features

### Progress Reporting

During batch upload, you'll see:
- A progress bar showing completion percentage
- Real-time count of processed todos
- Individual todo completion status

```
Starting batch upload of 50 todos...
Progress: [████████████░░░░░░░░] 60% | 30/50 todos
✓ Buy groceries
✓ Call John
↻ Schedule meeting (cached)
✗ Update report: Network error
```

### Caching

The batch processor includes intelligent caching:
- Calculates a hash of each todo's content
- Checks if identical content was previously uploaded
- Reuses existing blob IDs to save bandwidth and WAL tokens
- Reports cache hits in the final summary

### Error Handling

The batch processor continues even if some uploads fail:
- Failed uploads don't stop the entire batch
- Errors are collected and reported at the end
- Retry logic automatically handles transient network issues
- Detailed error messages help diagnose problems

### Summary Statistics

After batch processing completes, you'll see:

```
Batch Upload Summary:
  Total todos: 50
  Successful: 47
  Failed: 3
  Cache hits: 12
  Time taken: 45.2s
  Network: testnet
  Epochs: 5

Failed uploads:
  - Important meeting: Network timeout
  - Project deadline: Insufficient WAL balance
  - Team standup: Connection refused
```

## Performance Tips

1. **Optimal Batch Size**: Start with the default (5) and increase gradually
2. **Network Conditions**: Lower batch size on slow connections
3. **System Resources**: Higher batch sizes use more memory and connections
4. **Cache Warming**: Frequently uploaded todos benefit from caching

## Technical Details

The batch upload system uses:
- `BatchProcessor` for concurrent execution
- `PerformanceCache` for caching blob IDs
- `RetryManager` for automatic retries
- SHA-256 hashing for content comparison
- Exponential backoff for retry delays

## Troubleshooting

### Common Issues

1. **"Insufficient WAL balance" errors**
   - Solution: Get more WAL tokens with `walrus --context testnet get-wal`

2. **Network timeouts**
   - Solution: Reduce batch size or check internet connection

3. **High failure rate**
   - Solution: Use `--mock` flag to test without network calls

### Debug Mode

For detailed debugging information:

```bash
waltodo store --all --list my-todos --verbose
```

This shows:
- Detailed network requests
- Cache hit/miss information
- Retry attempts
- Full error stack traces

## Best Practices

1. **Start Small**: Test with a small list first
2. **Monitor Progress**: Watch for patterns in failures
3. **Use Caching**: Let the cache warm up over multiple runs
4. **Adjust Batch Size**: Find the sweet spot for your setup
5. **Handle Failures**: Check the summary for failed uploads

## Configuration

The batch upload feature respects these environment variables:

- `WALRUS_BATCH_SIZE`: Default batch size (default: 5)
- `WALRUS_CACHE_TTL`: Cache duration in milliseconds (default: 3600000)
- `WALRUS_RETRY_ATTEMPTS`: Number of retry attempts (default: 3)
- `WALRUS_RETRY_DELAY`: Initial retry delay in milliseconds (default: 1000)

## See Also

- [Storage Commands](./storage-command-usage.md)
- [Walrus Integration](./walrusintegration.md)
- [Performance Optimization](./performance-guide.md)