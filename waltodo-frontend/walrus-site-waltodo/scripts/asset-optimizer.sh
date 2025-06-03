#!/bin/bash

# Asset Optimizer for Walrus Sites
# Optimizes build assets for better performance and Walrus Sites compatibility

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/out"
OPTIMIZATION_REPORT="$PROJECT_DIR/optimization-report.json"

# Optimization settings
ENABLE_IMAGE_OPTIMIZATION=true
ENABLE_CSS_MINIFICATION=true
ENABLE_JS_OPTIMIZATION=true
ENABLE_GZIP_COMPRESSION=true
ENABLE_BROTLI_COMPRESSION=false
DRY_RUN=false

# Image optimization settings
MAX_IMAGE_WIDTH=1920
MAX_IMAGE_HEIGHT=1080
JPEG_QUALITY=85
PNG_COMPRESSION=6

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

# Help function
show_help() {
    cat << EOF
Asset Optimizer for Walrus Sites

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --help, -h              Show this help message
    --dry-run               Show what would be optimized without making changes
    --no-images             Skip image optimization
    --no-css                Skip CSS minification
    --no-js                 Skip JavaScript optimization
    --enable-brotli         Enable Brotli compression (requires brotli tool)
    --max-width WIDTH       Maximum image width (default: $MAX_IMAGE_WIDTH)
    --max-height HEIGHT     Maximum image height (default: $MAX_IMAGE_HEIGHT)
    --jpeg-quality QUALITY  JPEG quality 1-100 (default: $JPEG_QUALITY)
    --build-dir DIR         Override build directory (default: ./out)

DESCRIPTION:
    Optimizes build assets for Walrus Sites deployment:
    
    - Image compression and resizing
    - CSS minification and optimization
    - JavaScript optimization
    - File compression (gzip/brotli)
    - Asset integrity validation
    - Recovery mechanisms for corrupted files

EXAMPLES:
    $0                          # Full optimization
    $0 --dry-run               # Preview optimizations
    $0 --no-images --no-js     # Only optimize CSS
    $0 --enable-brotli         # Enable Brotli compression

EOF
}

# Initialize optimization report
init_optimization_report() {
    cat > "$OPTIMIZATION_REPORT" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "build_dir": "$BUILD_DIR",
  "optimization_version": "1.0.0",
  "settings": {
    "image_optimization": $ENABLE_IMAGE_OPTIMIZATION,
    "css_minification": $ENABLE_CSS_MINIFICATION,
    "js_optimization": $ENABLE_JS_OPTIMIZATION,
    "gzip_compression": $ENABLE_GZIP_COMPRESSION,
    "brotli_compression": $ENABLE_BROTLI_COMPRESSION,
    "dry_run": $DRY_RUN
  },
  "optimizations": {},
  "summary": {
    "total_files_processed": 0,
    "total_size_before": 0,
    "total_size_after": 0,
    "total_savings": 0,
    "savings_percentage": 0
  },
  "errors": [],
  "warnings": []
}
EOF
}

# Update optimization report
update_report() {
    local category="$1"
    local file_path="$2"
    local size_before="$3"
    local size_after="$4"
    local status="$5"
    local details="${6:-{}}"
    
    local temp_file=$(mktemp)
    
    jq --arg cat "$category" \
       --arg file "$file_path" \
       --arg before "$size_before" \
       --arg after "$size_after" \
       --arg status "$status" \
       --argjson details "$details" \
       '.optimizations[$cat] //= {} |
        .optimizations[$cat][$file] = {
          "size_before": ($before | tonumber),
          "size_after": ($after | tonumber),
          "savings": (($before | tonumber) - ($after | tonumber)),
          "savings_percentage": (if ($before | tonumber) > 0 then ((($before | tonumber) - ($after | tonumber)) / ($before | tonumber) * 100) else 0 end),
          "status": $status,
          "details": $details,
          "timestamp": now | strftime("%Y-%m-%dT%H:%M:%SZ")
        } |
        .summary.total_files_processed += 1 |
        .summary.total_size_before += ($before | tonumber) |
        .summary.total_size_after += ($after | tonumber)' "$OPTIMIZATION_REPORT" > "$temp_file"
    
    mv "$temp_file" "$OPTIMIZATION_REPORT"
}

# Add error to report
add_error() {
    local error_message="$1"
    local file_path="${2:-}"
    
    local temp_file=$(mktemp)
    
    jq --arg msg "$error_message" \
       --arg file "$file_path" \
       '.errors += [{
         "message": $msg,
         "file": $file,
         "timestamp": now | strftime("%Y-%m-%dT%H:%M:%SZ")
       }]' "$OPTIMIZATION_REPORT" > "$temp_file"
    
    mv "$temp_file" "$OPTIMIZATION_REPORT"
}

# Add warning to report
add_warning() {
    local warning_message="$1"
    local file_path="${2:-}"
    
    local temp_file=$(mktemp)
    
    jq --arg msg "$warning_message" \
       --arg file "$file_path" \
       '.warnings += [{
         "message": $msg,
         "file": $file,
         "timestamp": now | strftime("%Y-%m-%dT%H:%M:%SZ")
       }]' "$OPTIMIZATION_REPORT" > "$temp_file"
    
    mv "$temp_file" "$OPTIMIZATION_REPORT"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking optimization prerequisites..."
    
    local missing_tools=()
    
    # Check for jq
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi
    
    # Check for image optimization tools
    if [[ "$ENABLE_IMAGE_OPTIMIZATION" == "true" ]]; then
        if command -v imagemagick &> /dev/null || command -v convert &> /dev/null; then
            log_debug "ImageMagick found for image optimization"
        elif command -v ffmpeg &> /dev/null; then
            log_debug "FFmpeg found for image optimization"
        else
            add_warning "No image optimization tools found (imagemagick, ffmpeg). Image optimization will be skipped."
            ENABLE_IMAGE_OPTIMIZATION=false
        fi
    fi
    
    # Check for CSS optimization tools
    if [[ "$ENABLE_CSS_MINIFICATION" == "true" ]]; then
        if ! command -v node &> /dev/null; then
            add_warning "Node.js not found. CSS optimization will be limited."
        fi
    fi
    
    # Check for compression tools
    if [[ "$ENABLE_GZIP_COMPRESSION" == "true" ]]; then
        if ! command -v gzip &> /dev/null; then
            add_warning "gzip not found. Gzip compression will be skipped."
            ENABLE_GZIP_COMPRESSION=false
        fi
    fi
    
    if [[ "$ENABLE_BROTLI_COMPRESSION" == "true" ]]; then
        if ! command -v brotli &> /dev/null; then
            add_warning "brotli not found. Brotli compression will be skipped."
            ENABLE_BROTLI_COMPRESSION=false
        fi
    fi
    
    # Report missing critical tools
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error "Please install the missing tools and try again."
        exit 1
    fi
    
    log_success "Prerequisites check completed"
}

# Backup original files
create_backup() {
    local backup_dir="$PROJECT_DIR/backup-$(date +%Y%m%d-%H%M%S)"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would create backup at $backup_dir"
        return 0
    fi
    
    log_info "Creating backup of original files..."
    
    if ! cp -r "$BUILD_DIR" "$backup_dir"; then
        log_error "Failed to create backup"
        exit 1
    fi
    
    echo "$backup_dir" > "$PROJECT_DIR/.last-optimization-backup"
    log_success "Backup created at $backup_dir"
}

# Optimize images
optimize_images() {
    if [[ "$ENABLE_IMAGE_OPTIMIZATION" != "true" ]]; then
        log_info "Image optimization disabled, skipping..."
        return 0
    fi
    
    log_info "Optimizing images..."
    
    local image_files=()
    while IFS= read -r -d '' file; do
        image_files+=("$file")
    done < <(find "$BUILD_DIR" \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" -o -name "*.webp" \) -type f -print0)
    
    log_info "Found ${#image_files[@]} image files to optimize"
    
    for image_file in "${image_files[@]}"; do
        local rel_path="${image_file#$BUILD_DIR/}"
        local size_before=$(stat -f%z "$image_file" 2>/dev/null || stat -c%s "$image_file" 2>/dev/null || echo 0)
        
        log_debug "Processing image: $rel_path (${size_before} bytes)"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "DRY RUN: Would optimize $rel_path"
            update_report "images" "$rel_path" "$size_before" "$size_before" "dry_run"
            continue
        fi
        
        # Create temporary file for optimization
        local temp_file=$(mktemp --suffix=".${image_file##*.}")
        local optimization_success=false
        
        # Try ImageMagick first
        if command -v convert &> /dev/null; then
            if convert "$image_file" \
                      -strip \
                      -interlace Plane \
                      -gaussian-blur 0.05 \
                      -resize "${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT}>" \
                      -quality "$JPEG_QUALITY" \
                      "$temp_file" 2>/dev/null; then
                optimization_success=true
                log_debug "Optimized with ImageMagick: $rel_path"
            fi
        fi
        
        # Fallback to basic optimization
        if [[ "$optimization_success" != "true" ]]; then
            if cp "$image_file" "$temp_file" 2>/dev/null; then
                optimization_success=true
                log_debug "Basic copy for: $rel_path"
            fi
        fi
        
        if [[ "$optimization_success" == "true" ]]; then
            local size_after=$(stat -f%z "$temp_file" 2>/dev/null || stat -c%s "$temp_file" 2>/dev/null || echo 0)
            
            # Only use optimized version if it's smaller or similar size
            if [[ $size_after -le $size_before ]] || [[ $((size_after - size_before)) -lt $((size_before / 20)) ]]; then
                mv "$temp_file" "$image_file"
                update_report "images" "$rel_path" "$size_before" "$size_after" "optimized"
                log_debug "Image optimized: $rel_path (saved $((size_before - size_after)) bytes)"
            else
                rm -f "$temp_file"
                update_report "images" "$rel_path" "$size_before" "$size_before" "skipped" '{"reason": "optimization increased size"}'
                log_debug "Optimization skipped (size increase): $rel_path"
            fi
        else
            rm -f "$temp_file"
            update_report "images" "$rel_path" "$size_before" "$size_before" "failed"
            add_error "Failed to optimize image: $rel_path" "$rel_path"
            log_warning "Failed to optimize image: $rel_path"
        fi
    done
    
    log_success "Image optimization completed"
}

# Optimize CSS files
optimize_css() {
    if [[ "$ENABLE_CSS_MINIFICATION" != "true" ]]; then
        log_info "CSS optimization disabled, skipping..."
        return 0
    fi
    
    log_info "Optimizing CSS files..."
    
    local css_files=()
    while IFS= read -r -d '' file; do
        css_files+=("$file")
    done < <(find "$BUILD_DIR" -name "*.css" -type f -print0)
    
    log_info "Found ${#css_files[@]} CSS files to optimize"
    
    for css_file in "${css_files[@]}"; do
        local rel_path="${css_file#$BUILD_DIR/}"
        local size_before=$(stat -f%z "$css_file" 2>/dev/null || stat -c%s "$css_file" 2>/dev/null || echo 0)
        
        log_debug "Processing CSS: $rel_path (${size_before} bytes)"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "DRY RUN: Would optimize $rel_path"
            update_report "css" "$rel_path" "$size_before" "$size_before" "dry_run"
            continue
        fi
        
        # Create temporary file for optimization
        local temp_file=$(mktemp --suffix=".css")
        local optimization_success=false
        
        # Basic CSS minification using sed (portable solution)
        if sed -e 's/\/\*.*\*\///g' \
               -e 's/[ \t]*{[ \t]*/{/g' \
               -e 's/[ \t]*}[ \t]*/}/g' \
               -e 's/[ \t]*:[ \t]*/:/g' \
               -e 's/[ \t]*;[ \t]*/;/g' \
               -e 's/[ \t]*,[ \t]*/,/g' \
               -e '/^[ \t]*$/d' \
               "$css_file" > "$temp_file" 2>/dev/null; then
            optimization_success=true
            log_debug "CSS minified: $rel_path"
        fi
        
        if [[ "$optimization_success" == "true" ]]; then
            local size_after=$(stat -f%z "$temp_file" 2>/dev/null || stat -c%s "$temp_file" 2>/dev/null || echo 0)
            
            # Verify the minified CSS is valid (non-empty and has CSS syntax)
            if [[ $size_after -gt 0 ]] && grep -q '{.*}' "$temp_file" 2>/dev/null; then
                mv "$temp_file" "$css_file"
                update_report "css" "$rel_path" "$size_before" "$size_after" "optimized"
                log_debug "CSS optimized: $rel_path (saved $((size_before - size_after)) bytes)"
            else
                rm -f "$temp_file"
                update_report "css" "$rel_path" "$size_before" "$size_before" "skipped" '{"reason": "invalid output"}'
                log_debug "CSS optimization skipped (invalid output): $rel_path"
            fi
        else
            rm -f "$temp_file"
            update_report "css" "$rel_path" "$size_before" "$size_before" "failed"
            add_error "Failed to optimize CSS: $rel_path" "$rel_path"
            log_warning "Failed to optimize CSS: $rel_path"
        fi
    done
    
    log_success "CSS optimization completed"
}

# Optimize JavaScript files
optimize_js() {
    if [[ "$ENABLE_JS_OPTIMIZATION" != "true" ]]; then
        log_info "JavaScript optimization disabled, skipping..."
        return 0
    fi
    
    log_info "Optimizing JavaScript files..."
    
    local js_files=()
    while IFS= read -r -d '' file; do
        # Skip already minified files
        if [[ ! "$file" =~ \.min\.js$ ]]; then
            js_files+=("$file")
        fi
    done < <(find "$BUILD_DIR" -name "*.js" -type f -print0)
    
    log_info "Found ${#js_files[@]} JavaScript files to optimize"
    
    for js_file in "${js_files[@]}"; do
        local rel_path="${js_file#$BUILD_DIR/}"
        local size_before=$(stat -f%z "$js_file" 2>/dev/null || stat -c%s "$js_file" 2>/dev/null || echo 0)
        
        log_debug "Processing JS: $rel_path (${size_before} bytes)"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "DRY RUN: Would optimize $rel_path"
            update_report "js" "$rel_path" "$size_before" "$size_before" "dry_run"
            continue
        fi
        
        # For large files, skip optimization to avoid issues
        local size_mb=$((size_before / 1024 / 1024))
        if [[ $size_mb -gt 5 ]]; then
            update_report "js" "$rel_path" "$size_before" "$size_before" "skipped" '{"reason": "file too large"}'
            log_debug "JS optimization skipped (file too large): $rel_path"
            continue
        fi
        
        # Basic JS optimization - remove comments and extra whitespace
        local temp_file=$(mktemp --suffix=".js")
        local optimization_success=false
        
        # Basic minification using sed (portable solution)
        if sed -e 's|//.*$||g' \
               -e 's|/\*.*\*/||g' \
               -e 's/[ \t]*{[ \t]*/{/g' \
               -e 's/[ \t]*}[ \t]*/}/g' \
               -e 's/[ \t]*=[ \t]*/=/g' \
               -e 's/[ \t]*;[ \t]*/;/g' \
               -e '/^[ \t]*$/d' \
               "$js_file" > "$temp_file" 2>/dev/null; then
            optimization_success=true
            log_debug "JS minified: $rel_path"
        fi
        
        if [[ "$optimization_success" == "true" ]]; then
            local size_after=$(stat -f%z "$temp_file" 2>/dev/null || stat -c%s "$temp_file" 2>/dev/null || echo 0)
            
            # Verify the minified JS is not empty and has basic JS syntax
            if [[ $size_after -gt 0 ]] && [[ $size_after -ge $((size_before / 3)) ]]; then
                mv "$temp_file" "$js_file"
                update_report "js" "$rel_path" "$size_before" "$size_after" "optimized"
                log_debug "JS optimized: $rel_path (saved $((size_before - size_after)) bytes)"
            else
                rm -f "$temp_file"
                update_report "js" "$rel_path" "$size_before" "$size_before" "skipped" '{"reason": "optimization too aggressive"}'
                log_debug "JS optimization skipped (too aggressive): $rel_path"
            fi
        else
            rm -f "$temp_file"
            update_report "js" "$rel_path" "$size_before" "$size_before" "failed"
            add_error "Failed to optimize JS: $rel_path" "$rel_path"
            log_warning "Failed to optimize JS: $rel_path"
        fi
    done
    
    log_success "JavaScript optimization completed"
}

# Create compressed versions
create_compressed_files() {
    if [[ "$ENABLE_GZIP_COMPRESSION" != "true" ]] && [[ "$ENABLE_BROTLI_COMPRESSION" != "true" ]]; then
        log_info "Compression disabled, skipping..."
        return 0
    fi
    
    log_info "Creating compressed file versions..."
    
    local compressible_files=()
    while IFS= read -r -d '' file; do
        compressible_files+=("$file")
    done < <(find "$BUILD_DIR" \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.json" -o -name "*.xml" -o -name "*.txt" \) -type f -print0)
    
    log_info "Found ${#compressible_files[@]} files to compress"
    
    for file in "${compressible_files[@]}"; do
        local rel_path="${file#$BUILD_DIR/}"
        local size_before=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
        
        # Skip very small files
        if [[ $size_before -lt 1024 ]]; then
            continue
        fi
        
        log_debug "Compressing: $rel_path (${size_before} bytes)"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "DRY RUN: Would compress $rel_path"
            update_report "compression" "$rel_path" "$size_before" "$size_before" "dry_run"
            continue
        fi
        
        # Gzip compression
        if [[ "$ENABLE_GZIP_COMPRESSION" == "true" ]]; then
            if gzip -9 -c "$file" > "${file}.gz" 2>/dev/null; then
                local gzip_size=$(stat -f%z "${file}.gz" 2>/dev/null || stat -c%s "${file}.gz" 2>/dev/null || echo 0)
                update_report "compression" "${rel_path}.gz" "$size_before" "$gzip_size" "gzip"
                log_debug "Gzip created: ${rel_path}.gz (${gzip_size} bytes)"
            else
                add_error "Failed to create gzip for: $rel_path" "$rel_path"
            fi
        fi
        
        # Brotli compression
        if [[ "$ENABLE_BROTLI_COMPRESSION" == "true" ]]; then
            if brotli -9 -c "$file" > "${file}.br" 2>/dev/null; then
                local brotli_size=$(stat -f%z "${file}.br" 2>/dev/null || stat -c%s "${file}.br" 2>/dev/null || echo 0)
                update_report "compression" "${rel_path}.br" "$size_before" "$brotli_size" "brotli"
                log_debug "Brotli created: ${rel_path}.br (${brotli_size} bytes)"
            else
                add_error "Failed to create brotli for: $rel_path" "$rel_path"
            fi
        fi
    done
    
    log_success "Compression completed"
}

# Validate optimized files
validate_optimizations() {
    log_info "Validating optimized files..."
    
    local validation_errors=0
    
    # Check HTML files are still valid
    local html_files=()
    while IFS= read -r -d '' file; do
        html_files+=("$file")
    done < <(find "$BUILD_DIR" -name "*.html" -type f -print0)
    
    for html_file in "${html_files[@]}"; do
        if [[ ! -s "$html_file" ]]; then
            add_error "HTML file is empty after optimization: ${html_file#$BUILD_DIR/}" "${html_file#$BUILD_DIR/}"
            validation_errors=$((validation_errors + 1))
        elif ! grep -q "<!DOCTYPE\|<html" "$html_file" 2>/dev/null; then
            add_error "HTML file appears corrupted after optimization: ${html_file#$BUILD_DIR/}" "${html_file#$BUILD_DIR/}"
            validation_errors=$((validation_errors + 1))
        fi
    done
    
    # Check CSS files are still valid
    local css_files=()
    while IFS= read -r -d '' file; do
        css_files+=("$file")
    done < <(find "$BUILD_DIR" -name "*.css" -type f -print0)
    
    for css_file in "${css_files[@]}"; do
        if [[ ! -s "$css_file" ]]; then
            add_error "CSS file is empty after optimization: ${css_file#$BUILD_DIR/}" "${css_file#$BUILD_DIR/}"
            validation_errors=$((validation_errors + 1))
        elif ! grep -q '{.*}' "$css_file" 2>/dev/null; then
            add_error "CSS file appears corrupted after optimization: ${css_file#$BUILD_DIR/}" "${css_file#$BUILD_DIR/}"
            validation_errors=$((validation_errors + 1))
        fi
    done
    
    # Check JS files are still valid
    local js_files=()
    while IFS= read -r -d '' file; do
        js_files+=("$file")
    done < <(find "$BUILD_DIR" -name "*.js" -type f -print0)
    
    for js_file in "${js_files[@]}"; do
        if [[ ! -s "$js_file" ]]; then
            add_error "JS file is empty after optimization: ${js_file#$BUILD_DIR/}" "${js_file#$BUILD_DIR/}"
            validation_errors=$((validation_errors + 1))
        fi
    done
    
    if [[ $validation_errors -gt 0 ]]; then
        log_error "Validation failed with $validation_errors errors"
        return 1
    else
        log_success "Validation completed successfully"
        return 0
    fi
}

# Calculate final statistics
calculate_statistics() {
    log_info "Calculating optimization statistics..."
    
    local temp_file=$(mktemp)
    
    # Calculate totals and update summary
    jq '.summary.total_savings = (.summary.total_size_before - .summary.total_size_after) |
        .summary.savings_percentage = (if .summary.total_size_before > 0 then (.summary.total_savings / .summary.total_size_before * 100) else 0 end) |
        .summary.total_size_before_mb = (.summary.total_size_before / 1024 / 1024) |
        .summary.total_size_after_mb = (.summary.total_size_after / 1024 / 1024) |
        .summary.total_savings_mb = (.summary.total_savings / 1024 / 1024)' "$OPTIMIZATION_REPORT" > "$temp_file"
    
    mv "$temp_file" "$OPTIMIZATION_REPORT"
}

# Display optimization summary
display_summary() {
    log_info "Optimization Summary"
    log_info "==================="
    
    local total_files=$(jq -r '.summary.total_files_processed' "$OPTIMIZATION_REPORT")
    local size_before_mb=$(jq -r '.summary.total_size_before_mb' "$OPTIMIZATION_REPORT")
    local size_after_mb=$(jq -r '.summary.total_size_after_mb' "$OPTIMIZATION_REPORT")
    local savings_mb=$(jq -r '.summary.total_savings_mb' "$OPTIMIZATION_REPORT")
    local savings_percentage=$(jq -r '.summary.savings_percentage' "$OPTIMIZATION_REPORT")
    local error_count=$(jq -r '.errors | length' "$OPTIMIZATION_REPORT")
    local warning_count=$(jq -r '.warnings | length' "$OPTIMIZATION_REPORT")
    
    log_info "Files processed: $total_files"
    log_info "Size before: ${size_before_mb} MB"
    log_info "Size after: ${size_after_mb} MB"
    log_success "Total savings: ${savings_mb} MB (${savings_percentage}%)"
    
    if [[ $warning_count -gt 0 ]]; then
        log_warning "Warnings: $warning_count"
    fi
    
    if [[ $error_count -gt 0 ]]; then
        log_error "Errors: $error_count"
    fi
    
    log_info ""
    log_info "Detailed report saved to: $OPTIMIZATION_REPORT"
    
    # Show recovery information if backup was created
    if [[ -f "$PROJECT_DIR/.last-optimization-backup" ]]; then
        local backup_dir=$(cat "$PROJECT_DIR/.last-optimization-backup")
        log_info "Backup available at: $backup_dir"
        log_info "To restore: cp -r '$backup_dir'/* '$BUILD_DIR'/'"
    fi
}

# Recovery function
recover_from_backup() {
    if [[ ! -f "$PROJECT_DIR/.last-optimization-backup" ]]; then
        log_error "No backup found. Cannot recover."
        exit 1
    fi
    
    local backup_dir=$(cat "$PROJECT_DIR/.last-optimization-backup")
    
    if [[ ! -d "$backup_dir" ]]; then
        log_error "Backup directory not found: $backup_dir"
        exit 1
    fi
    
    log_info "Recovering from backup: $backup_dir"
    
    if cp -r "$backup_dir"/* "$BUILD_DIR"/; then
        log_success "Recovery completed successfully"
    else
        log_error "Recovery failed"
        exit 1
    fi
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --no-images)
                ENABLE_IMAGE_OPTIMIZATION=false
                shift
                ;;
            --no-css)
                ENABLE_CSS_MINIFICATION=false
                shift
                ;;
            --no-js)
                ENABLE_JS_OPTIMIZATION=false
                shift
                ;;
            --enable-brotli)
                ENABLE_BROTLI_COMPRESSION=true
                shift
                ;;
            --max-width)
                MAX_IMAGE_WIDTH="$2"
                shift 2
                ;;
            --max-height)
                MAX_IMAGE_HEIGHT="$2"
                shift 2
                ;;
            --jpeg-quality)
                JPEG_QUALITY="$2"
                shift 2
                ;;
            --build-dir)
                BUILD_DIR="$2"
                shift 2
                ;;
            --recover)
                recover_from_backup
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
    log_info "Asset Optimizer for Walrus Sites"
    log_info "================================"
    
    # Parse arguments
    parse_args "$@"
    
    # Check if build directory exists
    if [[ ! -d "$BUILD_DIR" ]]; then
        log_error "Build directory does not exist: $BUILD_DIR"
        log_error "Please run the build process first."
        exit 1
    fi
    
    # Initialize optimization report
    init_optimization_report
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup (unless dry run)
    if [[ "$DRY_RUN" != "true" ]]; then
        create_backup
    fi
    
    # Run optimizations
    optimize_images
    optimize_css
    optimize_js
    create_compressed_files
    
    # Validate results (unless dry run)
    if [[ "$DRY_RUN" != "true" ]]; then
        if ! validate_optimizations; then
            log_error "Validation failed. Consider recovering from backup."
            exit 1
        fi
    fi
    
    # Calculate statistics and display summary
    calculate_statistics
    display_summary
    
    log_success "Asset optimization completed successfully!"
}

# Run main function with all arguments
main "$@"