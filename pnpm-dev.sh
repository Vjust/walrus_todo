#!/bin/bash

# WalTodo Development Orchestrator
# Starts all services (CLI + API + Web) in tmux panes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Session name
SESSION_NAME="waltodo-dev"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[ORCHESTRATOR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    print_error "tmux is not installed. Please install tmux first:"
    echo "  macOS: brew install tmux"
    echo "  Ubuntu: apt-get install tmux"
    echo "  Arch: pacman -S tmux"
    exit 1
fi

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    print_warning "Session '$SESSION_NAME' already exists"
    read -p "Do you want to kill the existing session and start fresh? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        tmux kill-session -t "$SESSION_NAME"
        print_status "Killed existing session"
    else
        print_info "Attaching to existing session..."
        tmux attach-session -t "$SESSION_NAME"
        exit 0
    fi
fi

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install pnpm first:"
    echo "  npm install -g pnpm"
    exit 1
fi

# Ensure dependencies are installed
print_status "Checking dependencies..."
if [ ! -d "node_modules" ]; then
    print_status "Installing root dependencies..."
    pnpm install
fi

if [ ! -d "waltodo-frontend/node_modules" ]; then
    print_status "Installing frontend dependencies..."
    cd waltodo-frontend && pnpm install && cd ..
fi

# Build CLI for development
print_status "Building CLI for development..."
pnpm build:dev

# Create tmux session with first window
print_status "Creating tmux session: $SESSION_NAME"
tmux new-session -d -s "$SESSION_NAME" -n "main"

# Split the window into 3 panes
print_status "Setting up tmux panes..."

# Split horizontally first (top and bottom)
tmux split-window -h -t "$SESSION_NAME:main"

# Split the right pane vertically (right top and right bottom)
tmux split-window -v -t "$SESSION_NAME:main.1"

# Now we have 3 panes:
# - Pane 0 (left): CLI
# - Pane 1 (right top): API Server
# - Pane 2 (right bottom): Web Frontend

# Set pane titles and start services
print_status "Starting services in tmux panes..."

# Pane 0: CLI (left pane)
tmux send-keys -t "$SESSION_NAME:main.0" "clear" Enter
tmux send-keys -t "$SESSION_NAME:main.0" "echo '🚀 WalTodo CLI Development Environment'" Enter
tmux send-keys -t "$SESSION_NAME:main.0" "echo ''" Enter
tmux send-keys -t "$SESSION_NAME:main.0" "echo 'Available commands:'" Enter
tmux send-keys -t "$SESSION_NAME:main.0" "echo '  waltodo --help       # Show all commands'" Enter
tmux send-keys -t "$SESSION_NAME:main.0" "echo '  waltodo add \"task\"   # Add a new todo'" Enter
tmux send-keys -t "$SESSION_NAME:main.0" "echo '  waltodo list         # List all todos'" Enter
tmux send-keys -t "$SESSION_NAME:main.0" "echo '  waltodo status       # Show system status'" Enter
tmux send-keys -t "$SESSION_NAME:main.0" "echo ''" Enter
tmux send-keys -t "$SESSION_NAME:main.0" "echo 'Press Ctrl+C to stop any service, Ctrl+B then Q to quit tmux'" Enter
tmux send-keys -t "$SESSION_NAME:main.0" "echo ''" Enter

# Pane 1: API Server (right top)
tmux send-keys -t "$SESSION_NAME:main.1" "clear" Enter
tmux send-keys -t "$SESSION_NAME:main.1" "echo '🔧 Starting API Server on port 3001...'" Enter
tmux send-keys -t "$SESSION_NAME:main.1" "echo 'Waiting 3 seconds before start...'" Enter
tmux send-keys -t "$SESSION_NAME:main.1" "sleep 3" Enter
tmux send-keys -t "$SESSION_NAME:main.1" "PORT=3001 pnpm start:api" Enter

# Pane 2: Web Frontend (right bottom)
tmux send-keys -t "$SESSION_NAME:main.2" "clear" Enter
tmux send-keys -t "$SESSION_NAME:main.2" "echo '🌐 Starting Web Frontend on port 3000...'" Enter
tmux send-keys -t "$SESSION_NAME:main.2" "echo 'Waiting 5 seconds before start...'" Enter
tmux send-keys -t "$SESSION_NAME:main.2" "sleep 5" Enter
tmux send-keys -t "$SESSION_NAME:main.2" "cd waltodo-frontend" Enter
tmux send-keys -t "$SESSION_NAME:main.2" "PORT=3000 pnpm dev" Enter

# Set the active pane to CLI (pane 0)
tmux select-pane -t "$SESSION_NAME:main.0"

# Set pane titles (if tmux version supports it)
tmux set-option -t "$SESSION_NAME" pane-border-status top 2>/dev/null || true
tmux set-option -t "$SESSION_NAME" pane-border-format "#P: #{pane_title}" 2>/dev/null || true
tmux select-pane -t "$SESSION_NAME:main.0" -T "CLI" 2>/dev/null || true
tmux select-pane -t "$SESSION_NAME:main.1" -T "API Server" 2>/dev/null || true
tmux select-pane -t "$SESSION_NAME:main.2" -T "Web Frontend" 2>/dev/null || true

print_status "Development environment started!"
print_info "Services:"
print_info "  • CLI: Ready for commands (left pane)"
print_info "  • API: Starting on http://localhost:3001 (top right)"
print_info "  • Web: Starting on http://localhost:3000 (bottom right)"
print_info ""
print_info "Tmux commands:"
print_info "  • Ctrl+B then arrow keys: Switch between panes"
print_info "  • Ctrl+B then Q: Quit tmux session"
print_info "  • Ctrl+B then D: Detach (keeps running in background)"
print_info "  • tmux attach-session -t $SESSION_NAME: Reattach later"
print_info ""
print_status "Attaching to tmux session..."

# Attach to the session
tmux attach-session -t "$SESSION_NAME"