# @waltodo/shared-constants

Shared constants and configurations for WalTodo CLI and API to ensure consistent data storage paths.

## Usage

```typescript
import { SHARED_STORAGE_CONFIG, ensureTodosDirectory } from '@waltodo/shared-constants';

// Get the absolute path to the Todos directory
const todosPath = SHARED_STORAGE_CONFIG.getTodosPath();

// Ensure the directory exists
await ensureTodosDirectory();
```

## Environment Variables

- `TODO_DATA_PATH`: Override the default Todos directory location

## Default Paths

By default, todos are stored in `{project_root}/Todos` which ensures both CLI and API access the same data.