# Storage Command Usage Guide

The Walrus Todo CLI now includes powerful storage management and optimization features through the new `storage` command. This document explains how to use these features to manage your Walrus blockchain storage efficiently.

## Command Overview

```bash
# Basic storage information
walrus-todo storage

# Show a summary of storage allocation
walrus-todo storage --summary

# Show detailed information about all storage objects
walrus-todo storage --detail

# Analyze storage efficiency and get recommendations
walrus-todo storage --analyze
```

## Features

### Storage Summary

The `--summary` flag (or default with no flags) provides a quick overview of your active storage allocation:

- Total size and used space
- Remaining space available
- Usage percentage
- Expiration information
- Smart recommendations based on your usage patterns

### Detailed Storage Information

The `--detail` flag shows comprehensive information about all your storage objects:

- Lists all storage objects (active and expired)
- Shows size, usage, and remaining space for each
- Provides visual status indicators for easier identification
- Includes total summary statistics

### Storage Efficiency Analysis

The `--analyze` flag provides intelligent recommendations for optimizing your storage usage:

- Analyzes cost savings for different todo sizes
- Recommends whether to reuse existing storage or allocate new storage
- Shows WAL token savings from storage reuse
- Provides tailored recommendations based on your storage profile

## Understanding Storage Optimization

The CLI implements several strategies to optimize your Walrus storage:

1. **Smart Storage Reuse**: The CLI automatically analyzes your existing storage allocations and reuses them when possible, saving you WAL tokens.

2. **Best-Fit Algorithm**: When multiple storage allocations are available, the system uses a "best fit" algorithm to select the most efficient option.

3. **Cost Benefit Analysis**: The system calculates the exact cost savings from reusing existing storage versus creating new storage.

## Usage Examples

### Example 1: Basic Storage Check

```bash
$ walrus-todo storage
```

This command shows a basic summary of your storage allocation, including size, usage, and expiration information.

### Example 2: Detailed Storage Analysis

```bash
$ walrus-todo storage --detail
```

This provides detailed information about all your storage objects, including:
- Storage IDs
- Total and used sizes
- Remaining space
- Expiration dates
- Status indicators

### Example 3: Storage Efficiency Analysis

```bash
$ walrus-todo storage --analyze
```

This analyzes your storage usage and provides recommendations for optimization, including:
- Cost analysis for different todo sizes
- Recommendations for reusing existing storage
- WAL token savings calculations
- Overall storage strategy recommendations

## Best Practices

1. **Regular Monitoring**: Check your storage status regularly with `walrus-todo storage` to keep track of usage and expiration.

2. **Pre-Storage Analysis**: Before storing large amounts of data, use `walrus-todo storage --analyze` to determine the most efficient approach.

3. **Group Todos**: When possible, store multiple todos together in a TodoList to share storage allocation and reduce costs.

4. **Renew Expiring Storage**: Monitor storage expiration dates and renew storage before it expires to maintain data availability.

## Storage Status Indicators

The detailed view uses color-coded status indicators to help you quickly identify storage status:

- 🟢 **ACTIVE**: Storage is active and has sufficient space
- 🟡 **ALMOST FULL**: Storage is over 90% full
- 🟡 **EXPIRING SOON**: Storage will expire in less than 20 epochs
- 🔴 **EXPIRED**: Storage has expired and is no longer available

These indicators help you prioritize storage management tasks and identify issues at a glance.