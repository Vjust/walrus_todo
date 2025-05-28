# 🚀 CLI Performance Optimization Guide

## 🐌 **Current Issue**
The CLI is running slowly because:
1. **BackgroundOrchestrator** is consuming high memory for simple operations
2. **Background job system** is overkill for local todo operations  
3. **Memory monitoring** is reducing concurrent jobs unnecessarily
4. **Complex initialization** for simple local tasks

## ⚡ **Quick Fix: Use Simple Commands**

### **Fast Local-Only Commands:**
```bash
# Use the simple command for fast local operations
waltodo simple add "My todo" --content "Quick local todo"
waltodo simple list
waltodo simple complete 1

# These bypass the heavy background orchestration system
```

### **Disable Background Operations:**
```bash
# Add the --no-background flag to skip background processing
waltodo add "Fast todo" --no-background
waltodo list --no-background

# Or set environment variable to disable globally
export WALTODO_NO_BACKGROUND=true
waltodo add "Fast todo"
```

## 🔧 **Performance Optimizations Needed**

### **1. Memory Usage Optimization**
The BackgroundOrchestrator is designed for complex blockchain operations but creates overhead for simple local tasks.

### **2. Conditional Background Processing**
Background operations should only activate for:
- Blockchain storage operations
- Walrus uploads
- AI processing
- NFT creation

NOT for:
- Local todo creation
- Local list operations
- Simple completions

### **3. Fast Path for Local Operations**
Local operations should bypass:
- Background job queue
- Memory monitoring
- Complex orchestration
- Network connectivity checks

## ⚡ **Immediate Solutions**

### **Option 1: Use Simple Commands (Fastest)**
```bash
# These are optimized for speed
waltodo simple add "Task 1"
waltodo simple add "Task 2" 
waltodo simple list
```

### **Option 2: Disable Background Processing**
```bash
# Set environment variable
export WALTODO_NO_BACKGROUND=true

# Now regular commands will be fast
waltodo add "Fast task"
waltodo list
```

### **Option 3: Kill Background Processes**
```bash
# If still slow, restart terminal or kill background processes
pkill -f "BackgroundOrchestrator"
```

## 📊 **Expected Performance**

### **Current (Slow)**
- Local todo creation: 30+ seconds
- Memory warnings and job throttling
- Background orchestrator overhead

### **Optimized (Fast)**
- Local todo creation: <1 second
- No memory warnings
- Direct local file operations

## 🎯 **Recommended Workflow**

For **local development and simple todos**:
```bash
# Use simple commands (fastest)
waltodo simple add "My task"
waltodo simple list
waltodo simple complete 1
```

For **blockchain/Walrus operations** (when needed):
```bash
# Use full commands for complex operations
waltodo store "Important task" --blockchain
waltodo create "NFT task" --wallet 0x123...
```

## 🔄 **Long-term Fix Needed**

The system needs intelligent mode detection:
- **Simple Mode**: Fast local operations (default)
- **Advanced Mode**: Full blockchain/Walrus capabilities (explicit flag)

This would make the CLI responsive for daily use while preserving advanced features when needed.

---

**Quick Fix**: Use `waltodo simple add` for fast local operations! ⚡