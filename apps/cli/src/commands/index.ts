// OCLIF Command Discovery - Commands are automatically discovered by OCLIF
// This file is primarily for backwards compatibility and programmatic access
// Individual command files should export as default for OCLIF auto-discovery

// Re-export commands for backwards compatibility
export { default as AccountShowCommand } from './account/show';
export { default as AccountSwitchCommand } from './account/switch';
export { default as AddCommand } from './add';
export { default as AiCommand } from './ai';
export { default as CancelCommand } from './cancel';
export { default as CheckCommand } from './check';
export { default as CompleteCommand } from './complete';
export { default as ConfigureCommand } from './configure';
export { default as CreateCommand } from './create';
export { default as DeleteCommand } from './delete';
export { default as DemoProgressCommand } from './demo-progress';
export { default as DeployCommand } from './deploy';
export { default as DeployDiagnosticsCommand } from './deploy/diagnostics';
export { default as DeployEnhancedCommand } from './deploy/enhanced';
export { default as DeploySiteCommand } from './deploy-site';
export { default as InteractiveCommand } from './interactive';
export { default as JobsCommand } from './jobs';
export { default as ListCommand } from './list';
export { default as QueueCommand } from './queue';
export { default as RetrieveCommand } from './retrieve';
export { default as ShareCommand } from './share';
export { default as SimpleCommand } from './simple';
export { default as StatusCommand } from './status';
export { default as StoreCommand } from './store';
export { default as StoreFileCommand } from './store-file';
export { default as SyncCommand } from './sync';
export { default as TemplateCommand } from './template';
export { default as UpdateCommand } from './update';
