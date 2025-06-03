#!/bin/bash

# Build Recovery Tool for Walrus Sites
# Handles recovery from build failures, corruption, and missing assets

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$(cd "$PROJECT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/out"
RECOVERY_LOG="$PROJECT_DIR/recovery.log"

# Recovery modes
RECOVERY_MODE=""
AUTO_FIX=false
DRY_RUN=false
BACKUP_DIR=""

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$RECOVERY_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$RECOVERY_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$RECOVERY_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$RECOVERY_LOG" >&2
}

log_debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $1" | tee -a "$RECOVERY_LOG"
    fi
}

log_step() {
    echo -e "${MAGENTA}[STEP]${NC} $1" | tee -a "$RECOVERY_LOG"
}

# Help function
show_help() {
    cat << EOF
Build Recovery Tool for Walrus Sites

USAGE:
    $0 [MODE] [OPTIONS]

MODES:
    diagnose                 Diagnose build issues without fixing
    clean                    Clean all build artifacts and caches
    rebuild                  Clean rebuild from scratch
    restore                  Restore from backup
    fix-missing             Fix missing essential files
    fix-corruption          Fix corrupted files
    fix-dependencies        Fix dependency issues
    emergency               Emergency recovery (all fixes)

OPTIONS:
    --auto                  Automatically apply fixes without prompts
    --dry-run               Show what would be done without executing
    --backup-dir DIR        Specify backup directory for restore
    --build-dir DIR         Override build directory (default: ./out)
    --debug                 Enable debug output
    -h, --help              Show this help message

DESCRIPTION:
    Provides comprehensive recovery mechanisms for Walrus Sites build issues:
    
    - Diagnoses common build problems
    - Cleans corrupted build artifacts
    - Restores from backups
    - Fixes missing or corrupted files
    - Resolves dependency conflicts
    - Emergency recovery procedures

EXAMPLES:
    $0 diagnose                          # Diagnose issues
    $0 clean --auto                      # Clean build automatically
    $0 rebuild --dry-run                 # Preview rebuild process
    $0 restore --backup-dir ./backup    # Restore from specific backup
    $0 emergency --auto                  # Emergency recovery

EOF
}

# Initialize recovery log
init_recovery_log() {
    cat > "$RECOVERY_LOG" << EOF
=======================================================
Build Recovery Log - $(date)
=======================================================
Recovery Mode: $RECOVERY_MODE
Auto Fix: $AUTO_FIX
Dry Run: $DRY_RUN
Build Directory: $BUILD_DIR
=======================================================

EOF
}

# Diagnose build issues
diagnose_build() {
    log_step "Diagnosing build issues..."
    
    local issues_found=0
    local critical_issues=0
    
    # Check if build directory exists
    if [[ ! -d "$BUILD_DIR" ]]; then
        log_error "Build directory does not exist: $BUILD_DIR"
        critical_issues=$((critical_issues + 1))
    else
        log_info "Build directory exists: $BUILD_DIR"
        
        # Check if build directory is empty
        if [[ -z "$(ls -A "$BUILD_DIR" 2>/dev/null)" ]]; then
            log_error "Build directory is empty"
            critical_issues=$((critical_issues + 1))
        else
            log_info "Build directory contains files"
        fi
    fi
    
    # Check for essential files
    local essential_files=("index.html" "404.html" "_next")
    for file in "${essential_files[@]}"; do
        if [[ ! -e "$BUILD_DIR/$file" ]]; then
            log_error "Missing essential file: $file"
            issues_found=$((issues_found + 1))
        else
            log_info "Found essential file: $file"
        fi
    done
    
    # Check for corrupted HTML files
    if [[ -d "$BUILD_DIR" ]]; then
        local html_files=()
        while IFS= read -r -d '' file; do
            html_files+=("$file")
        done < <(find "$BUILD_DIR" -name "*.html" -type f -print0 2>/dev/null)
        
        for html_file in "${html_files[@]}"; do
            if [[ ! -s "$html_file" ]]; then
                log_error "Empty HTML file: ${html_file#$BUILD_DIR/}"
                issues_found=$((issues_found + 1))
            elif ! grep -q "<!DOCTYPE\|<html" "$html_file" 2>/dev/null; then
                log_error "Corrupted HTML file: ${html_file#$BUILD_DIR/}"
                issues_found=$((issues_found + 1))
            fi
        done
    fi
    
    # Check for dependency issues in frontend
    if [[ -f "$FRONTEND_DIR/package.json" ]]; then
        log_info "Checking dependencies..."
        if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
            log_warning "Node modules not installed"
            issues_found=$((issues_found + 1))
        else
            log_info "Node modules installed"
        fi
        
        # Check for package-lock issues
        if [[ -f "$FRONTEND_DIR/package-lock.json" && -f "$FRONTEND_DIR/pnpm-lock.yaml" ]]; then
            log_warning "Both package-lock.json and pnpm-lock.yaml exist - potential conflict"
            issues_found=$((issues_found + 1))
        fi
    fi
    
    # Check for .next directory issues
    if [[ -d "$FRONTEND_DIR/.next" ]]; then
        log_info "Next.js cache directory exists"
        
        # Check for corrupted cache
        if [[ ! -f "$FRONTEND_DIR/.next/BUILD_ID" ]]; then
            log_warning "Next.js BUILD_ID missing - cache may be corrupted"
            issues_found=$((issues_found + 1))
        fi
    fi
    
    # Check for available backups
    local backup_count=0
    if [[ -f "$PROJECT_DIR/.last-optimization-backup" ]]; then
        local backup_dir=$(cat "$PROJECT_DIR/.last-optimization-backup")
        if [[ -d "$backup_dir" ]]; then
            log_info "Optimization backup available: $backup_dir"
            backup_count=$((backup_count + 1))
        fi
    fi
    
    # Look for other backups
    local backup_dirs=()
    while IFS= read -r -d '' dir; do
        backup_dirs+=("$dir")
    done < <(find "$PROJECT_DIR" -name "backup-*" -type d -print0 2>/dev/null || true)
    
    if [[ ${#backup_dirs[@]} -gt 0 ]]; then
        log_info "Found ${#backup_dirs[@]} backup directories"
        backup_count=$((backup_count + ${#backup_dirs[@]}))
    fi
    
    # Summary
    log_info ""
    log_info "Diagnosis Summary:"
    log_info "================="
    log_info "Critical issues: $critical_issues"
    log_info "Other issues: $issues_found"
    log_info "Available backups: $backup_count"
    
    if [[ $critical_issues -gt 0 ]]; then
        log_error "Critical issues require immediate attention"
        return 2
    elif [[ $issues_found -gt 0 ]]; then
        log_warning "Issues found that should be addressed"
        return 1
    else
        log_success "No issues detected"
        return 0
    fi
}

# Clean build artifacts
clean_build() {
    log_step "Cleaning build artifacts..."
    
    local items_to_clean=(
        "$BUILD_DIR"
        "$FRONTEND_DIR/.next"
        "$FRONTEND_DIR/node_modules/.cache"
        "$PROJECT_DIR/build-validation-report.json"
        "$PROJECT_DIR/optimization-report.json"
    )
    
    for item in "${items_to_clean[@]}"; do
        if [[ -e "$item" ]]; then
            if [[ "$DRY_RUN" == "true" ]]; then
                log_info "DRY RUN: Would remove $item"
            else
                log_info "Removing: $item"
                rm -rf "$item"
            fi
        else
            log_debug "Not found (skipping): $item"
        fi
    done
    
    log_success "Build artifacts cleaned"
}

# Rebuild from scratch
rebuild_from_scratch() {
    log_step "Rebuilding from scratch..."
    
    # Clean first
    clean_build
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would reinstall dependencies and rebuild"
        return 0
    fi
    
    # Reinstall dependencies
    log_info "Reinstalling dependencies..."
    cd "$FRONTEND_DIR"
    
    # Remove lock files if they exist
    if [[ -f "package-lock.json" ]]; then
        rm -f package-lock.json
    fi
    
    # Install dependencies
    if command -v pnpm &> /dev/null; then
        pnpm install
    elif command -v npm &> /dev/null; then
        npm install
    else
        log_error "No package manager found (pnpm or npm required)"
        return 1
    fi
    
    # Run build
    log_info "Running build..."
    if command -v pnpm &> /dev/null; then
        pnpm run build:export
    elif command -v npm &> /dev/null; then
        npm run build:export
    else
        log_error "No package manager found for build"
        return 1
    fi
    
    log_success "Rebuild completed"
}

# Restore from backup
restore_from_backup() {
    log_step "Restoring from backup..."
    
    local backup_to_use="$BACKUP_DIR"
    
    # If no backup specified, try to find one
    if [[ -z "$backup_to_use" ]]; then
        if [[ -f "$PROJECT_DIR/.last-optimization-backup" ]]; then
            backup_to_use=$(cat "$PROJECT_DIR/.last-optimization-backup")
            log_info "Using last optimization backup: $backup_to_use"
        else
            # Look for the most recent backup
            local latest_backup=""
            local latest_time=0
            
            local backup_dirs=()
            while IFS= read -r -d '' dir; do
                backup_dirs+=("$dir")
            done < <(find "$PROJECT_DIR" -name "backup-*" -type d -print0 2>/dev/null || true)
            
            for backup_dir in "${backup_dirs[@]}"; do
                local backup_time=$(stat -f%m "$backup_dir" 2>/dev/null || stat -c%Y "$backup_dir" 2>/dev/null || echo 0)
                if [[ $backup_time -gt $latest_time ]]; then
                    latest_time=$backup_time
                    latest_backup="$backup_dir"
                fi
            done
            
            if [[ -n "$latest_backup" ]]; then
                backup_to_use="$latest_backup"
                log_info "Using most recent backup: $backup_to_use"
            fi
        fi
    fi
    
    if [[ -z "$backup_to_use" ]] || [[ ! -d "$backup_to_use" ]]; then
        log_error "No valid backup found for restoration"
        return 1
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would restore from $backup_to_use"
        return 0
    fi
    
    # Remove current build if it exists
    if [[ -d "$BUILD_DIR" ]]; then
        log_info "Removing current build..."
        rm -rf "$BUILD_DIR"
    fi
    
    # Restore from backup
    log_info "Restoring from backup: $backup_to_use"
    if cp -r "$backup_to_use" "$BUILD_DIR"; then
        log_success "Restoration completed successfully"
    else
        log_error "Restoration failed"
        return 1
    fi
}

# Fix missing essential files
fix_missing_files() {
    log_step "Fixing missing essential files..."
    
    local files_fixed=0
    
    # Create basic index.html if missing
    if [[ ! -f "$BUILD_DIR/index.html" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "DRY RUN: Would create basic index.html"
        else
            log_info "Creating basic index.html..."
            mkdir -p "$BUILD_DIR"
            cat > "$BUILD_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WalTodo - Decentralized Todo App</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .container { max-width: 600px; margin: 0 auto; }
        .error { color: #e74c3c; }
        .info { color: #3498db; }
    </style>
</head>
<body>
    <div class="container">
        <h1>WalTodo</h1>
        <p class="error">The application is currently being rebuilt.</p>
        <p class="info">Please check back in a few minutes.</p>
        <p><a href="javascript:location.reload()">Refresh Page</a></p>
    </div>
</body>
</html>
EOF
            files_fixed=$((files_fixed + 1))
        fi
    fi
    
    # Create basic 404.html if missing
    if [[ ! -f "$BUILD_DIR/404.html" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "DRY RUN: Would create basic 404.html"
        else
            log_info "Creating basic 404.html..."
            mkdir -p "$BUILD_DIR"
            cat > "$BUILD_DIR/404.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Not Found - WalTodo</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .container { max-width: 600px; margin: 0 auto; }
        .error { color: #e74c3c; }
    </style>
</head>
<body>
    <div class="container">
        <h1>404 - Page Not Found</h1>
        <p class="error">The page you're looking for doesn't exist.</p>
        <p><a href="/">Return to Home</a></p>
    </div>
</body>
</html>
EOF
            files_fixed=$((files_fixed + 1))
        fi
    fi
    
    # Create basic manifest.json if missing
    if [[ ! -f "$BUILD_DIR/manifest.json" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "DRY RUN: Would create basic manifest.json"
        else
            log_info "Creating basic manifest.json..."
            mkdir -p "$BUILD_DIR"
            cat > "$BUILD_DIR/manifest.json" << 'EOF'
{
  "name": "WalTodo",
  "short_name": "WalTodo",
  "description": "Decentralized Todo App on Sui and Walrus",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#3498db",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
EOF
            files_fixed=$((files_fixed + 1))
        fi
    fi
    
    if [[ $files_fixed -gt 0 ]]; then
        log_success "Fixed $files_fixed missing files"
    else
        log_info "No missing files to fix"
    fi
}

# Fix corrupted files
fix_corrupted_files() {
    log_step "Fixing corrupted files..."
    
    local files_fixed=0
    
    if [[ ! -d "$BUILD_DIR" ]]; then
        log_warning "Build directory doesn't exist, creating..."
        if [[ "$DRY_RUN" != "true" ]]; then
            mkdir -p "$BUILD_DIR"
        fi
        return 0
    fi
    
    # Check and fix HTML files
    local html_files=()
    while IFS= read -r -d '' file; do
        html_files+=("$file")
    done < <(find "$BUILD_DIR" -name "*.html" -type f -print0 2>/dev/null)
    
    for html_file in "${html_files[@]}"; do
        local rel_path="${html_file#$BUILD_DIR/}"
        
        # Check if file is empty
        if [[ ! -s "$html_file" ]]; then
            if [[ "$DRY_RUN" == "true" ]]; then
                log_info "DRY RUN: Would remove empty HTML file: $rel_path"
            else
                log_warning "Removing empty HTML file: $rel_path"
                rm -f "$html_file"
                files_fixed=$((files_fixed + 1))
            fi
            continue
        fi
        
        # Check if file has basic HTML structure
        if ! grep -q "<!DOCTYPE\|<html" "$html_file" 2>/dev/null; then
            if [[ "$DRY_RUN" == "true" ]]; then
                log_info "DRY RUN: Would fix corrupted HTML file: $rel_path"
            else
                log_warning "Fixing corrupted HTML file: $rel_path"
                # Try to wrap content in basic HTML structure
                local temp_file=$(mktemp)
                cat > "$temp_file" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WalTodo</title>
</head>
<body>
$(cat "$html_file")
</body>
</html>
EOF
                mv "$temp_file" "$html_file"
                files_fixed=$((files_fixed + 1))
            fi
        fi
    done
    
    if [[ $files_fixed -gt 0 ]]; then
        log_success "Fixed $files_fixed corrupted files"
    else
        log_info "No corrupted files found"
    fi
}

# Fix dependency issues
fix_dependencies() {
    log_step "Fixing dependency issues..."
    
    cd "$FRONTEND_DIR"
    
    # Remove conflicting lock files
    local lock_files_removed=0
    if [[ -f "package-lock.json" && -f "pnpm-lock.yaml" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "DRY RUN: Would remove package-lock.json (keeping pnpm-lock.yaml)"
        else
            log_info "Removing package-lock.json (keeping pnpm-lock.yaml)"
            rm -f package-lock.json
            lock_files_removed=$((lock_files_removed + 1))
        fi
    fi
    
    # Clear npm cache
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would clear package manager cache"
    else
        log_info "Clearing package manager cache..."
        if command -v pnpm &> /dev/null; then
            pnpm store prune || true
        fi
        if command -v npm &> /dev/null; then
            npm cache clean --force || true
        fi
    fi
    
    # Reinstall node_modules if needed
    if [[ ! -d "node_modules" ]] || [[ $lock_files_removed -gt 0 ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "DRY RUN: Would reinstall dependencies"
        else
            log_info "Reinstalling dependencies..."
            if [[ -d "node_modules" ]]; then
                rm -rf node_modules
            fi
            
            if command -v pnpm &> /dev/null; then
                pnpm install
            elif command -v npm &> /dev/null; then
                npm install
            else
                log_error "No package manager found"
                return 1
            fi
        fi
    fi
    
    log_success "Dependency issues resolved"
}

# Emergency recovery
emergency_recovery() {
    log_step "Starting emergency recovery..."
    
    log_info "Step 1: Diagnosing issues..."
    local diagnosis_result=0
    diagnose_build || diagnosis_result=$?
    
    log_info "Step 2: Cleaning build artifacts..."
    clean_build
    
    log_info "Step 3: Fixing dependencies..."
    fix_dependencies
    
    log_info "Step 4: Attempting rebuild..."
    if rebuild_from_scratch; then
        log_success "Emergency recovery completed - rebuild successful"
        return 0
    fi
    
    log_warning "Rebuild failed, attempting backup restoration..."
    
    log_info "Step 5: Attempting backup restoration..."
    if restore_from_backup; then
        log_success "Emergency recovery completed - backup restored"
        return 0
    fi
    
    log_warning "Backup restoration failed, creating minimal working build..."
    
    log_info "Step 6: Creating minimal working build..."
    fix_missing_files
    fix_corrupted_files
    
    log_success "Emergency recovery completed - minimal build created"
    log_warning "Manual intervention may be required for full functionality"
}

# Parse command line arguments
parse_args() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 0
    fi
    
    RECOVERY_MODE="$1"
    shift
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --auto)
                AUTO_FIX=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --backup-dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            --build-dir)
                BUILD_DIR="$2"
                shift 2
                ;;
            --debug)
                export DEBUG=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Main execution
main() {
    # Parse arguments
    parse_args "$@"
    
    # Initialize recovery log
    init_recovery_log
    
    log_info "Build Recovery Tool for Walrus Sites"
    log_info "===================================="
    log_info "Mode: $RECOVERY_MODE"
    log_info "Build Directory: $BUILD_DIR"
    
    # Execute recovery mode
    case "$RECOVERY_MODE" in
        diagnose)
            diagnose_build
            ;;
        clean)
            if [[ "$AUTO_FIX" == "true" ]] || [[ "$DRY_RUN" == "true" ]]; then
                clean_build
            else
                read -p "Are you sure you want to clean all build artifacts? (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    clean_build
                else
                    log_info "Clean operation cancelled"
                fi
            fi
            ;;
        rebuild)
            if [[ "$AUTO_FIX" == "true" ]] || [[ "$DRY_RUN" == "true" ]]; then
                rebuild_from_scratch
            else
                read -p "Are you sure you want to rebuild from scratch? (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    rebuild_from_scratch
                else
                    log_info "Rebuild operation cancelled"
                fi
            fi
            ;;
        restore)
            restore_from_backup
            ;;
        fix-missing)
            fix_missing_files
            ;;
        fix-corruption)
            fix_corrupted_files
            ;;
        fix-dependencies)
            fix_dependencies
            ;;
        emergency)
            if [[ "$AUTO_FIX" == "true" ]] || [[ "$DRY_RUN" == "true" ]]; then
                emergency_recovery
            else
                read -p "Are you sure you want to run emergency recovery? (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    emergency_recovery
                else
                    log_info "Emergency recovery cancelled"
                fi
            fi
            ;;
        *)
            log_error "Unknown recovery mode: $RECOVERY_MODE"
            show_help
            exit 1
            ;;
    esac
    
    log_info ""
    log_info "Recovery log saved to: $RECOVERY_LOG"
    log_success "Recovery operation completed"
}

# Run main function with all arguments
main "$@"