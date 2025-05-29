# WalTodo API Server

A complete Express.js API server with REST endpoints and WebSocket broadcasting for the WalTodo application.

## Features

- **REST API**: Full CRUD operations for todos with pagination
- **WebSocket Support**: Real-time broadcasting of todo events
- **Multi-wallet Isolation**: Data separation by wallet address
- **Authentication**: Optional API key and JWT authentication
- **Validation**: Comprehensive input validation with Zod
- **Rate Limiting**: Configurable rate limiting
- **Health Checks**: Multiple health check endpoints
- **Logging**: Structured logging with Winston
- **Docker Support**: Complete containerization

## Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Start development server
pnpm dev

# Or start with custom port
pnpm dev --port=3001
```

### Production

```bash
# Build application
pnpm build

# Start production server
pnpm start

# Or with Docker
docker build -t waltodo-api .
docker run -p 3000:3000 waltodo-api
```

## API Endpoints

### Health Checks
- `GET /healthz` - Basic health check
- `GET /health` - Detailed health information
- `GET /ready` - Readiness probe
- `GET /live` - Liveness probe

### Todo Operations
- `GET /api/v1/todos` - List todos with pagination
- `GET /api/v1/todos/:id` - Get specific todo
- `POST /api/v1/todos` - Create new todo
- `PUT /api/v1/todos/:id` - Update todo
- `PATCH /api/v1/todos/:id` - Partial update
- `DELETE /api/v1/todos/:id` - Delete todo
- `POST /api/v1/todos/:id/complete` - Mark complete
- `POST /api/v1/todos/batch` - Batch operations

### Metadata
- `GET /api/v1/todos/categories` - Get categories
- `GET /api/v1/todos/tags` - Get tags  
- `GET /api/v1/todos/stats` - Get statistics

## WebSocket Events

### Client → Server
- `authenticate` - Authenticate with wallet
- `join-wallet` - Join wallet room
- `leave-wallet` - Leave wallet room
- `sync-request` - Request sync

### Server → Client
- `todo-created` - Todo was created
- `todo-updated` - Todo was updated
- `todo-deleted` - Todo was deleted
- `todo-completed` - Todo was completed
- `sync-requested` - Sync was requested
- `error` - Error occurred

## Authentication

### API Key (Optional)
Add header: `X-API-Key: your-api-key`

### JWT (Optional)
Add header: `Authorization: Bearer your-jwt-token`

### Wallet Address
Add header: `X-Wallet-Address: 0x...` or query param `?wallet=0x...`

## Configuration

Environment variables (see `.env.example`):

- `API_PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `API_AUTH_REQUIRED` - Enable authentication
- `API_CORS_ORIGINS` - Allowed CORS origins
- `WS_ENABLED` - Enable WebSocket support
- `TODO_DATA_PATH` - Path to todo data directory

## Data Storage

The API integrates with the existing CLI's todo storage system:
- Todos stored as JSON files in `Todos/` directory
- One file per wallet address
- Compatible with CLI data format

## Docker Deployment

```bash
# Build image
docker build -t waltodo-api .

# Run container
docker run -d \
  --name waltodo-api \
  -p 3000:3000 \
  -v $(pwd)/Todos:/app/Todos \
  -e API_AUTH_REQUIRED=true \
  -e API_KEYS=your-secure-api-key \
  waltodo-api

# Check health
curl http://localhost:3000/healthz
```

## API Usage Examples

### Create Todo
```bash
curl -X POST http://localhost:3000/api/v1/todos \
  -H "Content-Type: application/json" \
  -H "X-Wallet-Address: 0x..." \
  -d '{
    "description": "Buy groceries",
    "priority": "high",
    "category": "personal",
    "tags": ["shopping", "urgent"]
  }'
```

### List Todos
```bash
curl "http://localhost:3000/api/v1/todos?wallet=0x...&page=1&limit=10"
```

### WebSocket Connection
```javascript
const socket = io('http://localhost:3000');

socket.emit('authenticate', { wallet: '0x...' });
socket.emit('join-wallet', { wallet: '0x...' });

socket.on('todo-created', (todo) => {
  console.log('New todo:', todo);
});
```

## Error Handling

All API responses follow this format:
```json
{
  "success": true|false,
  "data": {...},
  "message": "Success message",
  "error": "Error message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Rate Limiting

Default limits:
- 100 requests per 15 minutes per IP
- Configurable via environment variables

## Logging

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console (development only)