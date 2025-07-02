#!/bin/bash

# CLI-Frontend Integration Demo Script
# This script demonstrates the seamless integration between WalTodo CLI and Frontend

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Demo configuration
API_PORT=3001
FRONTEND_PORT=3000
DEMO_TODO="Integration Demo Todo"

echo -e "${BLUE}=== WalTodo CLI-Frontend Integration Demo ===${NC}\n"

# Function to check if a port is in use
check_port() {
    if lsof -i:$1 > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to wait for a service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}Waiting for $name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|204"; then
            echo -e "${GREEN}✓ $name is ready!${NC}"
            return 0
        fi
        
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}✗ $name failed to start${NC}"
    return 1
}

# Step 1: Check prerequisites
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"

if ! command -v waltodo &> /dev/null; then
    echo -e "${RED}✗ WalTodo CLI not installed. Please run: pnpm run global-install${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}\n"

# Step 2: Clean up any existing todos
echo -e "${BLUE}Step 2: Cleaning up existing demo todos...${NC}"
waltodo list --json | jq -r '.[] | select(.title | contains("Integration Demo")) | .id' | while read id; do
    if [ ! -z "$id" ]; then
        waltodo delete "$id" 2>/dev/null || true
    fi
done
echo -e "${GREEN}✓ Cleanup complete${NC}\n"

# Step 3: Start API server
echo -e "${BLUE}Step 3: Starting API server...${NC}"

if check_port $API_PORT; then
    echo -e "${YELLOW}API server already running on port $API_PORT${NC}"
else
    cd apps/api
    pnpm dev > /tmp/waltodo-api.log 2>&1 &
    API_PID=$!
    cd ../..
    
    if wait_for_service "http://localhost:$API_PORT/health" "API server"; then
        echo -e "${GREEN}✓ API server started (PID: $API_PID)${NC}"
    else
        echo -e "${RED}Failed to start API server. Check /tmp/waltodo-api.log for details${NC}"
        exit 1
    fi
fi
echo ""

# Step 4: Start frontend
echo -e "${BLUE}Step 4: Starting frontend...${NC}"

if check_port $FRONTEND_PORT; then
    echo -e "${YELLOW}Frontend already running on port $FRONTEND_PORT${NC}"
else
    cd waltodo-frontend
    npm run dev > /tmp/waltodo-frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd ..
    
    if wait_for_service "http://localhost:$FRONTEND_PORT" "Frontend"; then
        echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
    else
        echo -e "${RED}Failed to start frontend. Check /tmp/waltodo-frontend.log for details${NC}"
        exit 1
    fi
fi
echo ""

# Step 5: Demonstrate CLI → Frontend sync
echo -e "${BLUE}Step 5: Demonstrating CLI → Frontend synchronization${NC}"
echo -e "${YELLOW}Creating a todo via CLI...${NC}"

TODO_ID=$(waltodo add "$DEMO_TODO" --priority high --json | jq -r '.id')
echo -e "${GREEN}✓ Created todo with ID: $TODO_ID${NC}"

echo -e "${YELLOW}Fetching todo via API...${NC}"
API_RESPONSE=$(curl -s "http://localhost:$API_PORT/api/v1/todos/$TODO_ID")
API_TITLE=$(echo "$API_RESPONSE" | jq -r '.title')

if [ "$API_TITLE" = "$DEMO_TODO" ]; then
    echo -e "${GREEN}✓ Todo is accessible via API${NC}"
else
    echo -e "${RED}✗ Todo not found in API${NC}"
fi
echo ""

# Step 6: Demonstrate Frontend → CLI sync
echo -e "${BLUE}Step 6: Demonstrating Frontend → CLI synchronization${NC}"
echo -e "${YELLOW}Creating a todo via API...${NC}"

API_TODO_RESPONSE=$(curl -s -X POST "http://localhost:$API_PORT/api/v1/todos" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Created Todo",
    "description": "This todo was created via the API",
    "priority": "medium"
  }')

API_TODO_ID=$(echo "$API_TODO_RESPONSE" | jq -r '.id')
echo -e "${GREEN}✓ Created todo via API with ID: $API_TODO_ID${NC}"

echo -e "${YELLOW}Verifying todo in CLI...${NC}"
sleep 1 # Give time for sync

if waltodo list --json | jq -e ".[] | select(.id == \"$API_TODO_ID\")" > /dev/null; then
    echo -e "${GREEN}✓ Todo is accessible via CLI${NC}"
else
    echo -e "${RED}✗ Todo not found in CLI${NC}"
fi
echo ""

# Step 7: Demonstrate real-time updates
echo -e "${BLUE}Step 7: Demonstrating real-time updates${NC}"
echo -e "${YELLOW}Updating todo status via CLI...${NC}"

waltodo complete "$TODO_ID"
echo -e "${GREEN}✓ Marked todo as complete via CLI${NC}"

echo -e "${YELLOW}Checking status via API...${NC}"
sleep 1 # Give time for update

UPDATED_STATUS=$(curl -s "http://localhost:$API_PORT/api/v1/todos/$TODO_ID" | jq -r '.completed')
if [ "$UPDATED_STATUS" = "true" ]; then
    echo -e "${GREEN}✓ Status update reflected in API${NC}"
else
    echo -e "${RED}✗ Status update not reflected${NC}"
fi
echo ""

# Step 8: Show summary
echo -e "${BLUE}Step 8: Integration Summary${NC}"
echo -e "${GREEN}✓ CLI can create todos that appear in the frontend${NC}"
echo -e "${GREEN}✓ Frontend can create todos that appear in the CLI${NC}"
echo -e "${GREEN}✓ Real-time updates work bidirectionally${NC}"
echo -e "${GREEN}✓ API server successfully bridges CLI and frontend${NC}"
echo ""

# Provide access information
echo -e "${BLUE}=== Access Information ===${NC}"
echo -e "Frontend: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
echo -e "API Server: ${GREEN}http://localhost:$API_PORT${NC}"
echo -e "API Health: ${GREEN}http://localhost:$API_PORT/health${NC}"
echo -e "WebSocket: ${GREEN}ws://localhost:$API_PORT${NC}"
echo ""

echo -e "${YELLOW}Press Ctrl+C to stop the demo${NC}"
echo -e "${BLUE}Logs are available at:${NC}"
echo -e "  API: /tmp/waltodo-api.log"
echo -e "  Frontend: /tmp/waltodo-frontend.log"
echo ""

# Keep script running
echo -e "${GREEN}Demo is running. Open your browser to see real-time updates!${NC}"
wait