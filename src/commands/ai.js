const { BaseCommand } = require('../base-command');
const chalk = require('chalk');

class AI extends BaseCommand {
  async run() {
    const { flags } = await this.parse(AI);
    
    // Get API key from flag or environment
    const apiKey = flags.apiKey || process.env.XAI_API_KEY;
    if (!apiKey) {
      this.error('API key is required. Provide it via --apiKey flag or XAI_API_KEY environment variable.');
    }
    
    // Convert provider flag to AIProvider enum if provided
    let provider;
    if (flags.provider) {
      provider = flags.provider;
    }
    
    // Initialize verification service if --verify flag is used
    let verificationService;
    if (flags.verify) {
      // In a real implementation, we would initialize the verifier adapter
      // and verification service here. For now, we'll use a placeholder.
      verificationService = {};
      this.log(chalk.cyan('Blockchain verification enabled.'));
    }
    
    // Import services dynamically to avoid TypeScript issues in JavaScript file
    const { 
      EnhancedAIService, 
      AIConfigManager 
    } = require('../services/ai');
    
    // Initialize the configuration manager
    const configManager = AIConfigManager.getInstance();
    
    // Set temperature if provided
    if (flags.temperature !== undefined) {
      configManager.updateGlobalConfig({
        defaultTemperature: flags.temperature / 100 // Convert from 0-100 to 0.0-1.0
      });
    }
    
    // Set enhanced prompts flag
    configManager.updateGlobalConfig({
      useEnhancedPrompts: flags.enhanced
    });
    
    // Handle cache settings
    if (flags.clearCache) {
      // Clear the operation-specific cache
      const enhancedService = new EnhancedAIService(apiKey, provider, flags.model, {}, verificationService);
      enhancedService.clearCache(flags.operation);
      this.log(chalk.dim(`Cache cleared for ${flags.operation} operation.`));
    }
    
    // Initialize AI service
    const enhancedService = new EnhancedAIService(
      apiKey, 
      provider, 
      flags.model, 
      {}, 
      verificationService
    );
    
    // Configure cache for this operation
    enhancedService.configure({
      cacheEnabled: !flags.noCache
    });
    
    // Get all todos
    const todoService = await this.getTodoService();
    const todos = await todoService.listTodos();
    
    if (todos.length === 0) {
      this.log('No todos found to analyze.');
      return;
    }
    
    this.log(`Analyzing ${todos.length} todos with AI...`);
    
    // Map privacy flag to AIPrivacyLevel
    const { AIPrivacyLevel } = require('../types/adapters/AIVerifierAdapter');
    const privacyLevel = flags.privacy === 'public' 
      ? AIPrivacyLevel.PUBLIC 
      : flags.privacy === 'private' 
        ? AIPrivacyLevel.PRIVATE 
        : AIPrivacyLevel.HASH_ONLY;
    
    // Perform the requested operation
    if (flags.verify) {
      // Handle operations with verification
      await this.performOperationWithVerification(
        enhancedService,
        todos,
        flags.operation,
        flags.format,
        privacyLevel
      );
    } else {
      // Handle operations without verification
      await this.performOperation(
        enhancedService,
        todos,
        flags.operation,
        flags.format
      );
    }
    
    // Display cache stats if caching is enabled
    if (!flags.noCache) {
      const stats = enhancedService.getCacheStats();
      this.log(chalk.dim(`\nCache stats: ${stats.size} entries, ${Math.round(stats.hitRate * 100)}% hit rate`));
    }
  }
  
  // Handle all operations in a single method
  async performOperation(aiService, todos, operation, format) {
    this.log(chalk.bold(`Performing AI operation: ${operation}`));
    
    try {
      switch (operation) {
        case 'summarize':
          await this.summarize(aiService, todos, format);
          break;
        case 'categorize':
          await this.categorize(aiService, todos, format);
          break;
        case 'prioritize':
          await this.prioritize(aiService, todos, format);
          break;
        case 'suggest':
          await this.suggest(aiService, todos, format);
          break;
        case 'analyze':
          await this.analyze(aiService, todos, format);
          break;
        case 'group':
          await this.group(aiService, todos, format);
          break;
        case 'schedule':
          await this.schedule(aiService, todos, format);
          break;
        case 'detect_dependencies':
          await this.detectDependencies(aiService, todos, format);
          break;
        case 'estimate_effort':
          await this.estimateEffort(aiService, todos, format);
          break;
        default:
          this.error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      this.error(`Failed to perform ${operation} operation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Handle all verified operations
  async performOperationWithVerification(aiService, todos, operation, format, privacyLevel) {
    this.log(chalk.bold(`Performing verified AI operation: ${operation}`));
    
    try {
      switch (operation) {
        case 'summarize':
          await this.summarizeWithVerification(aiService, todos, format, privacyLevel);
          break;
        case 'categorize':
          await this.categorizeWithVerification(aiService, todos, format, privacyLevel);
          break;
        case 'prioritize':
          await this.prioritizeWithVerification(aiService, todos, format, privacyLevel);
          break;
        case 'suggest':
          await this.suggestWithVerification(aiService, todos, format, privacyLevel);
          break;
        case 'analyze':
          await this.analyzeWithVerification(aiService, todos, format, privacyLevel);
          break;
        case 'group':
          await this.groupWithVerification(aiService, todos, format, privacyLevel);
          break;
        case 'schedule':
          await this.scheduleWithVerification(aiService, todos, format, privacyLevel);
          break;
        case 'detect_dependencies':
          await this.detectDependenciesWithVerification(aiService, todos, format, privacyLevel);
          break;
        case 'estimate_effort':
          await this.estimateEffortWithVerification(aiService, todos, format, privacyLevel);
          break;
        default:
          this.error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      this.error(`Failed to perform verified ${operation} operation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Standard operations
  
  async summarize(aiService, todos, format) {
    this.log(chalk.bold('Generating Todo Summary:'));
    
    try {
      const summary = await aiService.summarize(todos);
      this.log(chalk.green(summary));
    } catch (error) {
      this.error(`Failed to summarize todos: ${error}`);
    }
  }
  
  async categorize(aiService, todos, format) {
    this.log(chalk.bold('Categorizing Todos:'));
    
    try {
      const categories = await aiService.categorize(todos);
      
      if (format === 'json') {
        this.log(JSON.stringify(categories, null, 2));
        return;
      }
      
      // Default to table format
      Object.entries(categories).forEach(([category, todoIds]) => {
        this.log(chalk.cyan(`\n${category}:`));
        
        todoIds.forEach(id => {
          const todo = todos.find(t => t.id === id);
          if (todo) {
            this.log(`  - ${todo.title}`);
          }
        });
      });
    } catch (error) {
      this.error(`Failed to categorize todos: ${error}`);
    }
  }
  
  async prioritize(aiService, todos, format) {
    this.log(chalk.bold('Prioritizing Todos:'));
    
    try {
      const priorities = await aiService.prioritize(todos);
      
      if (format === 'json') {
        this.log(JSON.stringify(priorities, null, 2));
        return;
      }
      
      // Create table data for prioritized todos
      const prioritizedTodos = todos
        .map(todo => ({
          id: todo.id,
          title: todo.title,
          priority: priorities[todo.id] || 0
        }))
        .sort((a, b) => b.priority - a.priority);
      
      // Display as a list with priority scores
      prioritizedTodos.forEach(todo => {
        const priorityColor = todo.priority >= 7 ? chalk.red : 
                             todo.priority >= 4 ? chalk.yellow : 
                             chalk.green;
        
        this.log(`${priorityColor(todo.priority.toString().padStart(2))} - ${todo.title}`);
      });
    } catch (error) {
      this.error(`Failed to prioritize todos: ${error}`);
    }
  }
  
  async suggest(aiService, todos, format) {
    this.log(chalk.bold('Suggesting New Todos:'));
    
    try {
      const suggestions = await aiService.suggest(todos);
      
      if (format === 'json') {
        this.log(JSON.stringify(suggestions, null, 2));
        return;
      }
      
      // Display suggestions
      suggestions.forEach((suggestion, index) => {
        this.log(`${index + 1}. ${suggestion}`);
      });
      
      this.log(chalk.dim('\nTip: Use "walrus_todo add" to add any of these suggestions'));
    } catch (error) {
      this.error(`Failed to generate todo suggestions: ${error}`);
    }
  }
  
  async analyze(aiService, todos, format) {
    this.log(chalk.bold('Analyzing Todos:'));
    
    try {
      const analysis = await aiService.analyze(todos);
      
      if (format === 'json') {
        this.log(JSON.stringify(analysis, null, 2));
        return;
      }
      
      // Display analysis sections
      Object.entries(analysis).forEach(([section, content]) => {
        this.log(chalk.cyan(`\n${section}:`));
        
        if (Array.isArray(content)) {
          content.forEach(item => {
            this.log(`  - ${item}`);
          });
        } else if (typeof content === 'object') {
          Object.entries(content).forEach(([key, value]) => {
            this.log(`  - ${key}: ${value}`);
          });
        } else {
          this.log(`  ${content}`);
        }
      });
    } catch (error) {
      this.error(`Failed to analyze todos: ${error}`);
    }
  }
  
  // New operations
  
  async group(aiService, todos, format) {
    this.log(chalk.bold('Grouping Todos into Workflows:'));
    
    try {
      const groups = await aiService.group(todos);
      
      if (format === 'json') {
        this.log(JSON.stringify(groups, null, 2));
        return;
      }
      
      // Display sequential tracks
      this.log(chalk.cyan('\nWorkflow Sequences:'));
      Object.entries(groups.sequentialTracks).forEach(([trackName, todoIds]) => {
        this.log(chalk.yellow(`\n${trackName}:`));
        
        todoIds.forEach((id, index) => {
          const todo = todos.find(t => t.id === id);
          if (todo) {
            this.log(`  ${index + 1}. ${todo.title}`);
          }
        });
      });
      
      // Display parallel opportunities
      if (groups.parallelOpportunities && groups.parallelOpportunities.length > 0) {
        this.log(chalk.cyan('\nParallel Opportunities:'));
        
        groups.parallelOpportunities.forEach((todoGroup, groupIndex) => {
          this.log(chalk.yellow(`\nGroup ${groupIndex + 1}:`));
          
          todoGroup.forEach(id => {
            const todo = todos.find(t => t.id === id);
            if (todo) {
              this.log(`  - ${todo.title}`);
            }
          });
        });
      }
    } catch (error) {
      this.error(`Failed to group todos: ${error}`);
    }
  }
  
  async schedule(aiService, todos, format) {
    this.log(chalk.bold('Creating Todo Schedule:'));
    
    try {
      const schedule = await aiService.schedule(todos);
      
      if (format === 'json') {
        this.log(JSON.stringify(schedule, null, 2));
        return;
      }
      
      // Create a timeline
      const scheduledTodos = todos
        .filter(todo => schedule[todo.id])
        .map(todo => ({
          id: todo.id,
          title: todo.title,
          start: schedule[todo.id].start,
          duration: schedule[todo.id].duration,
          due: schedule[todo.id].due
        }))
        .sort((a, b) => a.start - b.start);
      
      // Display as a timeline
      this.log(chalk.cyan('\nProposed Schedule:'));
      
      // Group by start day
      const byStartDay = {};
      scheduledTodos.forEach(todo => {
        byStartDay[todo.start] = byStartDay[todo.start] || [];
        byStartDay[todo.start].push(todo);
      });
      
      // Print by day
      Object.entries(byStartDay)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([day, dayTodos]) => {
          const dayLabel = day === '0' 
            ? 'Today' 
            : day === '1' 
              ? 'Tomorrow' 
              : `Day ${day}`;
          
          this.log(chalk.yellow(`\n${dayLabel}:`));
          
          dayTodos.forEach(todo => {
            const durationLabel = todo.duration === 1 
              ? '1 day' 
              : `${todo.duration} days`;
            
            const dueLabel = todo.due === 0 
              ? 'due today' 
              : todo.due === 1 
                ? 'due tomorrow' 
                : `due in ${todo.due} days`;
            
            this.log(`  - ${todo.title} (${durationLabel}, ${dueLabel})`);
          });
        });
    } catch (error) {
      this.error(`Failed to schedule todos: ${error}`);
    }
  }
  
  async detectDependencies(aiService, todos, format) {
    this.log(chalk.bold('Detecting Todo Dependencies:'));
    
    try {
      const dependencies = await aiService.detectDependencies(todos);
      
      if (format === 'json') {
        this.log(JSON.stringify(dependencies, null, 2));
        return;
      }
      
      // Display prerequisites for each todo
      this.log(chalk.cyan('\nDependencies (required before):')); 
      Object.entries(dependencies.dependencies).forEach(([todoId, depIds]) => {
        if (depIds.length === 0) return;
        
        const todo = todos.find(t => t.id === todoId);
        if (!todo) return;
        
        this.log(chalk.yellow(`\n${todo.title} depends on:`));
        
        depIds.forEach(depId => {
          const depTodo = todos.find(t => t.id === depId);
          if (depTodo) {
            this.log(`  - ${depTodo.title}`);
          }
        });
      });
      
      // Display blockers for each todo
      if (Object.keys(dependencies.blockers).length > 0) {
        this.log(chalk.cyan('\nBlockers (currently blocking):')); 
        Object.entries(dependencies.blockers).forEach(([todoId, blockerIds]) => {
          if (blockerIds.length === 0) return;
          
          const todo = todos.find(t => t.id === todoId);
          if (!todo) return;
          
          this.log(chalk.yellow(`\n${todo.title} is blocked by:`));
          
          blockerIds.forEach(blockerId => {
            const blockerTodo = todos.find(t => t.id === blockerId);
            if (blockerTodo) {
              this.log(`  - ${blockerTodo.title}`);
            }
          });
        });
      }
      
      // List independent todos
      const independentTodos = todos.filter(todo => 
        !dependencies.dependencies[todo.id] || 
        dependencies.dependencies[todo.id].length === 0
      );
      
      if (independentTodos.length > 0) {
        this.log(chalk.cyan('\nIndependent Todos (can start now):')); 
        independentTodos.forEach(todo => {
          this.log(`  - ${todo.title}`);
        });
      }
    } catch (error) {
      this.error(`Failed to detect dependencies: ${error}`);
    }
  }
  
  async estimateEffort(aiService, todos, format) {
    this.log(chalk.bold('Estimating Effort for Todos:'));
    
    try {
      const efforts = await aiService.estimateEffort(todos);
      
      if (format === 'json') {
        this.log(JSON.stringify(efforts, null, 2));
        return;
      }
      
      // Create a sorted list by effort
      const todosByEffort = todos
        .filter(todo => efforts[todo.id])
        .map(todo => ({
          id: todo.id,
          title: todo.title,
          effort: efforts[todo.id].effort,
          reasoning: efforts[todo.id].reasoning,
          hours: efforts[todo.id].estimated_hours
        }))
        .sort((a, b) => b.effort - a.effort);
      
      // Display estimates
      todosByEffort.forEach(todo => {
        const effortColor = todo.effort >= 4 ? chalk.red : 
                           todo.effort >= 3 ? chalk.yellow : 
                           chalk.green;
        
        const effortLabel = '★'.repeat(todo.effort) + '☆'.repeat(5 - todo.effort);
        const hoursLabel = todo.hours ? ` (~${todo.hours} hours)` : '';
        
        this.log(chalk.yellow(`\n${todo.title}:`));
        this.log(`  Effort: ${effortColor(effortLabel)}${hoursLabel}`);
        this.log(`  Reasoning: ${todo.reasoning}`);
      });
      
      // Summary statistics
      const totalEffort = todosByEffort.reduce((sum, todo) => sum + todo.effort, 0);
      const averageEffort = totalEffort / todosByEffort.length;
      
      const totalHours = todosByEffort
        .filter(todo => todo.hours)
        .reduce((sum, todo) => sum + (todo.hours || 0), 0);
      
      this.log(chalk.cyan('\nSummary:'));
      this.log(`  Average Effort: ${averageEffort.toFixed(1)} / 5`);
      if (totalHours > 0) {
        this.log(`  Total Estimated Hours: ${totalHours.toFixed(1)}`);
      }
    } catch (error) {
      this.error(`Failed to estimate effort: ${error}`);
    }
  }
  
  // Verified operations
  
  async summarizeWithVerification(aiService, todos, format, privacyLevel) {
    this.log(chalk.bold('Generating Verified Todo Summary:'));
    
    try {
      const result = await aiService.summarizeWithVerification(todos, privacyLevel);
      
      this.log(chalk.green(result.result));
      this.displayVerificationDetails(result.verification);
    } catch (error) {
      this.error(`Failed to summarize todos with verification: ${error}`);
    }
  }
  
  async categorizeWithVerification(aiService, todos, format, privacyLevel) {
    this.log(chalk.bold('Categorizing Todos with Verification:'));
    
    try {
      const result = await aiService.categorizeWithVerification(todos, privacyLevel);
      
      if (format === 'json') {
        this.log(JSON.stringify(result.result, null, 2));
      } else {
        // Default to table format
        Object.entries(result.result).forEach(([category, todoIds]) => {
          this.log(chalk.cyan(`\n${category}:`));
          
          todoIds.forEach(id => {
            const todo = todos.find(t => t.id === id);
            if (todo) {
              this.log(`  - ${todo.title}`);
            }
          });
        });
      }
      
      this.displayVerificationDetails(result.verification);
    } catch (error) {
      this.error(`Failed to categorize todos with verification: ${error}`);
    }
  }
  
  async prioritizeWithVerification(aiService, todos, format, privacyLevel) {
    this.log(chalk.bold('Prioritizing Todos with Verification:'));
    
    try {
      const result = await aiService.prioritizeWithVerification(todos, privacyLevel);
      
      if (format === 'json') {
        this.log(JSON.stringify(result.result, null, 2));
      } else {
        // Create table data for prioritized todos
        const prioritizedTodos = todos
          .map(todo => ({
            id: todo.id,
            title: todo.title,
            priority: result.result[todo.id] || 0
          }))
          .sort((a, b) => b.priority - a.priority);
        
        // Display as a list with priority scores
        prioritizedTodos.forEach(todo => {
          const priorityColor = todo.priority >= 7 ? chalk.red : 
                               todo.priority >= 4 ? chalk.yellow : 
                               chalk.green;
          
          this.log(`${priorityColor(todo.priority.toString().padStart(2))} - ${todo.title}`);
        });
      }
      
      this.displayVerificationDetails(result.verification);
    } catch (error) {
      this.error(`Failed to prioritize todos with verification: ${error}`);
    }
  }
  
  async suggestWithVerification(aiService, todos, format, privacyLevel) {
    this.log(chalk.bold('Suggesting New Todos with Verification:'));
    
    try {
      const result = await aiService.suggestWithVerification(todos, privacyLevel);
      
      if (format === 'json') {
        this.log(JSON.stringify(result.result, null, 2));
      } else {
        // Display suggestions
        result.result.forEach((suggestion, index) => {
          this.log(`${index + 1}. ${suggestion}`);
        });
        
        this.log(chalk.dim('\nTip: Use "walrus_todo add" to add any of these suggestions'));
      }
      
      this.displayVerificationDetails(result.verification);
    } catch (error) {
      this.error(`Failed to generate todo suggestions with verification: ${error}`);
    }
  }
  
  async analyzeWithVerification(aiService, todos, format, privacyLevel) {
    this.log(chalk.bold('Analyzing Todos with Verification:'));
    
    try {
      const result = await aiService.analyzeWithVerification(todos, privacyLevel);
      
      if (format === 'json') {
        this.log(JSON.stringify(result.result, null, 2));
      } else {
        // Display analysis sections
        Object.entries(result.result).forEach(([section, content]) => {
          this.log(chalk.cyan(`\n${section}:`));
          
          if (Array.isArray(content)) {
            content.forEach(item => {
              this.log(`  - ${item}`);
            });
          } else if (typeof content === 'object') {
            Object.entries(content).forEach(([key, value]) => {
              this.log(`  - ${key}: ${value}`);
            });
          } else {
            this.log(`  ${content}`);
          }
        });
      }
      
      this.displayVerificationDetails(result.verification);
    } catch (error) {
      this.error(`Failed to analyze todos with verification: ${error}`);
    }
  }
  
  // New verified operations
  
  async groupWithVerification(aiService, todos, format, privacyLevel) {
    this.log(chalk.bold('Grouping Todos into Workflows with Verification:'));
    
    try {
      const result = await aiService.groupWithVerification(todos, privacyLevel);
      
      if (format === 'json') {
        this.log(JSON.stringify(result.result, null, 2));
      } else {
        // Display sequential tracks
        this.log(chalk.cyan('\nWorkflow Sequences:'));
        Object.entries(result.result.sequentialTracks).forEach(([trackName, todoIds]) => {
          this.log(chalk.yellow(`\n${trackName}:`));
          
          todoIds.forEach((id, index) => {
            const todo = todos.find(t => t.id === id);
            if (todo) {
              this.log(`  ${index + 1}. ${todo.title}`);
            }
          });
        });
        
        // Display parallel opportunities
        if (result.result.parallelOpportunities && result.result.parallelOpportunities.length > 0) {
          this.log(chalk.cyan('\nParallel Opportunities:'));
          
          result.result.parallelOpportunities.forEach((todoGroup, groupIndex) => {
            this.log(chalk.yellow(`\nGroup ${groupIndex + 1}:`));
            
            todoGroup.forEach(id => {
              const todo = todos.find(t => t.id === id);
              if (todo) {
                this.log(`  - ${todo.title}`);
              }
            });
          });
        }
      }
      
      this.displayVerificationDetails(result.verification);
    } catch (error) {
      this.error(`Failed to group todos with verification: ${error}`);
    }
  }
  
  async scheduleWithVerification(aiService, todos, format, privacyLevel) {
    this.log(chalk.bold('Creating Todo Schedule with Verification:'));
    
    try {
      const result = await aiService.scheduleWithVerification(todos, privacyLevel);
      
      if (format === 'json') {
        this.log(JSON.stringify(result.result, null, 2));
      } else {
        // Create a timeline
        const scheduledTodos = todos
          .filter(todo => result.result[todo.id])
          .map(todo => ({
            id: todo.id,
            title: todo.title,
            start: result.result[todo.id].start,
            duration: result.result[todo.id].duration,
            due: result.result[todo.id].due
          }))
          .sort((a, b) => a.start - b.start);
        
        // Display as a timeline
        this.log(chalk.cyan('\nProposed Schedule:'));
        
        // Group by start day
        const byStartDay = {};
        scheduledTodos.forEach(todo => {
          byStartDay[todo.start] = byStartDay[todo.start] || [];
          byStartDay[todo.start].push(todo);
        });
        
        // Print by day
        Object.entries(byStartDay)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .forEach(([day, dayTodos]) => {
            const dayLabel = day === '0' 
              ? 'Today' 
              : day === '1' 
                ? 'Tomorrow' 
                : `Day ${day}`;
            
            this.log(chalk.yellow(`\n${dayLabel}:`));
            
            dayTodos.forEach(todo => {
              const durationLabel = todo.duration === 1 
                ? '1 day' 
                : `${todo.duration} days`;
              
              const dueLabel = todo.due === 0 
                ? 'due today' 
                : todo.due === 1 
                  ? 'due tomorrow' 
                  : `due in ${todo.due} days`;
              
              this.log(`  - ${todo.title} (${durationLabel}, ${dueLabel})`);
            });
          });
      }
      
      this.displayVerificationDetails(result.verification);
    } catch (error) {
      this.error(`Failed to schedule todos with verification: ${error}`);
    }
  }
  
  async detectDependenciesWithVerification(aiService, todos, format, privacyLevel) {
    this.log(chalk.bold('Detecting Todo Dependencies with Verification:'));
    
    try {
      const result = await aiService.detectDependenciesWithVerification(todos, privacyLevel);
      
      if (format === 'json') {
        this.log(JSON.stringify(result.result, null, 2));
      } else {
        // Display prerequisites for each todo
        this.log(chalk.cyan('\nDependencies (required before):')); 
        Object.entries(result.result.dependencies).forEach(([todoId, depIds]) => {
          if (depIds.length === 0) return;
          
          const todo = todos.find(t => t.id === todoId);
          if (!todo) return;
          
          this.log(chalk.yellow(`\n${todo.title} depends on:`));
          
          depIds.forEach(depId => {
            const depTodo = todos.find(t => t.id === depId);
            if (depTodo) {
              this.log(`  - ${depTodo.title}`);
            }
          });
        });
        
        // Display blockers for each todo
        if (Object.keys(result.result.blockers).length > 0) {
          this.log(chalk.cyan('\nBlockers (currently blocking):')); 
          Object.entries(result.result.blockers).forEach(([todoId, blockerIds]) => {
            if (blockerIds.length === 0) return;
            
            const todo = todos.find(t => t.id === todoId);
            if (!todo) return;
            
            this.log(chalk.yellow(`\n${todo.title} is blocked by:`));
            
            blockerIds.forEach(blockerId => {
              const blockerTodo = todos.find(t => t.id === blockerId);
              if (blockerTodo) {
                this.log(`  - ${blockerTodo.title}`);
              }
            });
          });
        }
        
        // List independent todos
        const independentTodos = todos.filter(todo => 
          !result.result.dependencies[todo.id] || 
          result.result.dependencies[todo.id].length === 0
        );
        
        if (independentTodos.length > 0) {
          this.log(chalk.cyan('\nIndependent Todos (can start now):')); 
          independentTodos.forEach(todo => {
            this.log(`  - ${todo.title}`);
          });
        }
      }
      
      this.displayVerificationDetails(result.verification);
    } catch (error) {
      this.error(`Failed to detect dependencies with verification: ${error}`);
    }
  }
  
  async estimateEffortWithVerification(aiService, todos, format, privacyLevel) {
    this.log(chalk.bold('Estimating Effort for Todos with Verification:'));
    
    try {
      const result = await aiService.estimateEffortWithVerification(todos, privacyLevel);
      
      if (format === 'json') {
        this.log(JSON.stringify(result.result, null, 2));
      } else {
        // Create a sorted list by effort
        const todosByEffort = todos
          .filter(todo => result.result[todo.id])
          .map(todo => ({
            id: todo.id,
            title: todo.title,
            effort: result.result[todo.id].effort,
            reasoning: result.result[todo.id].reasoning,
            hours: result.result[todo.id].estimated_hours
          }))
          .sort((a, b) => b.effort - a.effort);
        
        // Display estimates
        todosByEffort.forEach(todo => {
          const effortColor = todo.effort >= 4 ? chalk.red : 
                             todo.effort >= 3 ? chalk.yellow : 
                             chalk.green;
          
          const effortLabel = '★'.repeat(todo.effort) + '☆'.repeat(5 - todo.effort);
          const hoursLabel = todo.hours ? ` (~${todo.hours} hours)` : '';
          
          this.log(chalk.yellow(`\n${todo.title}:`));
          this.log(`  Effort: ${effortColor(effortLabel)}${hoursLabel}`);
          this.log(`  Reasoning: ${todo.reasoning}`);
        });
        
        // Summary statistics
        const totalEffort = todosByEffort.reduce((sum, todo) => sum + todo.effort, 0);
        const averageEffort = totalEffort / todosByEffort.length;
        
        const totalHours = todosByEffort
          .filter(todo => todo.hours)
          .reduce((sum, todo) => sum + (todo.hours || 0), 0);
        
        this.log(chalk.cyan('\nSummary:'));
        this.log(`  Average Effort: ${averageEffort.toFixed(1)} / 5`);
        if (totalHours > 0) {
          this.log(`  Total Estimated Hours: ${totalHours.toFixed(1)}`);
        }
      }
      
      this.displayVerificationDetails(result.verification);
    } catch (error) {
      this.error(`Failed to estimate effort with verification: ${error}`);
    }
  }
  
  displayVerificationDetails(verification) {
    this.log(chalk.bold('\nVerification Details:'));
    this.log(chalk.dim('─'.repeat(50)));
    this.log(`ID:        ${chalk.yellow(verification.id)}`);
    this.log(`Provider:  ${verification.provider}`);
    this.log(`Timestamp: ${new Date(verification.timestamp).toLocaleString()}`);
    this.log(`Privacy:   ${chalk.blue(verification.metadata.privacyLevel || 'hash_only')}`);
    this.log(chalk.dim('─'.repeat(50)));
    this.log(chalk.dim(`To view detailed verification information, run: ${chalk.cyan(`walrus_todo verify show ${verification.id}`)}`));
  }
}

AI.description = 'Use AI to analyze and manage todos';

AI.flags = {
  ...BaseCommand.flags,
  apiKey: { 
    char: 'k',
    description: 'API key for AI service',
    required: false,
    env: 'XAI_API_KEY'
  },
  operation: { 
    char: 'o',
    description: 'AI operation to perform',
    required: true,
    options: [
      // Original operations
      'summarize', 
      'categorize', 
      'prioritize', 
      'suggest', 
      'analyze',
      // New operations
      'group',
      'schedule',
      'detect_dependencies',
      'estimate_effort'
    ]
  },
  format: { 
    char: 'f',
    description: 'Output format (table or json)',
    required: false,
    default: 'table',
    options: ['table', 'json']
  },
  verify: { 
    char: 'v',
    description: 'Create blockchain verification for AI operation',
    default: false,
    allowNo: true
  },
  provider: { 
    char: 'p',
    description: 'Specify AI provider',
    required: false,
    options: ['xai', 'openai', 'anthropic']
  },
  model: { 
    char: 'm',
    description: 'Specify AI model to use',
    required: false
  },
  privacy: { 
    description: 'Privacy level for verified operations',
    options: ['public', 'hash_only', 'private'],
    default: 'hash_only'
  },
  noCache: { 
    description: 'Disable result caching for this operation',
    default: false,
    allowNo: true
  },
  clearCache: { 
    description: 'Clear the cache before performing the operation',
    default: false,
    allowNo: true
  },
  temperature: { 
    char: 't',
    description: 'Temperature setting for AI (0-100, representing 0.0-1.0)',
    parse: input => parseInt(input, 10),
    min: 0,
    max: 100
  },
  enhanced: { 
    char: 'e',
    description: 'Use enhanced prompts for better results',
    default: true,
    allowNo: true
  }
};

module.exports = AI;