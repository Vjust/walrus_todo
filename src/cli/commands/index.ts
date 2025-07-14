/**
 * Command index - exports all CLI commands organized by category
 * This is the main entry point for importing all commands
 */

// TODO Commands - Basic operations and bulk actions
export {
  addCommand,
  listCommand,
  doneCommand,
  deleteCommand,
  clearCommand,
  searchCommand,
  statsCommand
} from './todo';

// Blob Commands - Walrus storage operations
export {
  publishCommand,
  listPublishedCommand,
  blobStatusCommand,
  fetchCommand,
  downloadBlobCommand,
  blobStatsCommand,
  deleteBlobCommand,
  discoverCommand
} from './blob';

// Data Commands - Import/Export operations
export {
  exportCommand,
  importCommand
} from './data';

// System Commands - Utilities and shell integration
export {
  completionCommand
} from './system';