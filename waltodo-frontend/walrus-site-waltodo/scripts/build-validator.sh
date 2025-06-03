#!/bin/bash

# Enhanced Build Validation for Walrus Sites
# Comprehensive validation of Next.js static export output for Walrus Sites compatibility

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
VALIDATION_REPORT="$PROJECT_DIR/build-validation-report.json"

# Validation thresholds
MAX_BUILD_SIZE_MB=150
MAX_SINGLE_FILE_MB=25
MIN_REQUIRED_FILES=5
MAX_NESTING_DEPTH=10

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

# Initialize validation report
init_validation_report() {
    cat > "$VALIDATION_REPORT" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "build_dir": "$BUILD_DIR",
  "validation_version": "1.0.0",
  "checks": {},
  "summary": {
    "total_checks": 0,
    "passed": 0,
    "warnings": 0,
    "errors": 0,
    "critical_errors": 0
  },
  "recommendations": [],
  "performance_metrics": {},
  "walrus_compatibility": {}
}
EOF
}

# Update validation report
update_report() {
    local check_name="$1"
    local status="$2"
    local message="$3"
    local details="${4:-{}}"
    
    # Use a temporary file for atomic updates
    local temp_file=$(mktemp)
    
    jq --arg name "$check_name" \
       --arg status "$status" \
       --arg message "$message" \
       --argjson details "$details" \
       '.checks[$name] = {
         "status": $status,
         "message": $message,
         "details": $details,
         "timestamp": now | strftime("%Y-%m-%dT%H:%M:%SZ")
       } |
       .summary.total_checks += 1 |
       if $status == "pass" then .summary.passed += 1
       elif $status == "warning" then .summary.warnings += 1
       elif $status == "error" then .summary.errors += 1
       elif $status == "critical" then .summary.critical_errors += 1
       else . end' "$VALIDATION_REPORT" > "$temp_file"
    
    mv "$temp_file" "$VALIDATION_REPORT"
}

# Add recommendation to report
add_recommendation() {
    local recommendation="$1"
    local priority="${2:-medium}"
    
    local temp_file=$(mktemp)
    
    jq --arg rec "$recommendation" \
       --arg priority "$priority" \
       '.recommendations += [{
         "message": $rec,
         "priority": $priority,
         "timestamp": now | strftime("%Y-%m-%dT%H:%M:%SZ")
       }]' "$VALIDATION_REPORT" > "$temp_file"
    
    mv "$temp_file" "$VALIDATION_REPORT"
}

# Check if build directory exists and is not empty
validate_build_exists() {
    log_info "Validating build directory exists..."
    
    if [[ ! -d "$BUILD_DIR" ]]; then
        update_report "build_exists" "critical" "Build directory does not exist: $BUILD_DIR"
        log_error "Build directory does not exist: $BUILD_DIR"
        return 1
    fi
    
    local file_count=$(find "$BUILD_DIR" -type f | wc -l)
    if [[ $file_count -lt $MIN_REQUIRED_FILES ]]; then
        update_report "build_exists" "critical" "Build directory has insufficient files: $file_count < $MIN_REQUIRED_FILES"
        log_error "Build directory has insufficient files: $file_count"
        return 1
    fi
    
    update_report "build_exists" "pass" "Build directory exists with $file_count files"
    log_success "Build directory validation passed ($file_count files)"
    return 0
}

# Validate essential files for Walrus Sites
validate_essential_files() {
    log_info "Validating essential files for Walrus Sites..."
    
    local essential_files=(
        "index.html"
        "404.html"
        "_next/static"
        "manifest.json"
    )
    
    local optional_files=(
        "robots.txt"
        "sitemap.xml"
        "favicon.ico"
        "_headers"
    )
    
    local missing_essential=()
    local missing_optional=()
    local file_details="{}"
    
    # Check essential files
    for file in "${essential_files[@]}"; do
        local file_path="$BUILD_DIR/$file"
        if [[ ! -e "$file_path" ]]; then
            missing_essential+=("$file")
        else
            local size=$(du -sh "$file_path" 2>/dev/null | cut -f1 || echo "unknown")
            file_details=$(echo "$file_details" | jq --arg file "$file" --arg size "$size" '.essential[$file] = {"exists": true, "size": $size}')
        fi
    done
    
    # Check optional files
    for file in "${optional_files[@]}"; do
        local file_path="$BUILD_DIR/$file"
        if [[ ! -e "$file_path" ]]; then
            missing_optional+=("$file")
        else
            local size=$(du -sh "$file_path" 2>/dev/null | cut -f1 || echo "unknown")
            file_details=$(echo "$file_details" | jq --arg file "$file" --arg size "$size" '.optional[$file] = {"exists": true, "size": $size}')
        fi
    done
    
    # Report results
    if [[ ${#missing_essential[@]} -gt 0 ]]; then
        local missing_list=$(IFS=", "; echo "${missing_essential[*]}")
        update_report "essential_files" "critical" "Missing essential files: $missing_list" "$file_details"
        log_error "Missing essential files: $missing_list"
        return 1
    fi
    
    if [[ ${#missing_optional[@]} -gt 0 ]]; then
        local missing_list=$(IFS=", "; echo "${missing_optional[*]}")
        update_report "essential_files" "warning" "Missing optional files: $missing_list" "$file_details"
        log_warning "Missing optional files: $missing_list"
        add_recommendation "Consider adding missing optional files for better SEO and functionality: $missing_list"
    else
        update_report "essential_files" "pass" "All essential and optional files present" "$file_details"
    fi
    
    log_success "Essential files validation completed"
    return 0
}

# Validate HTML files for correctness and Walrus Sites compatibility
validate_html_files() {
    log_info "Validating HTML files..."
    
    local html_files=()
    local html_issues=()
    local html_details="{}"
    
    # Find all HTML files
    while IFS= read -r -d '' file; do
        html_files+=("$file")
    done < <(find "$BUILD_DIR" -name "*.html" -type f -print0)
    
    log_debug "Found ${#html_files[@]} HTML files"
    
    for html_file in "${html_files[@]}"; do
        local rel_path="${html_file#$BUILD_DIR/}"
        local file_size=$(stat -f%z "$html_file" 2>/dev/null || stat -c%s "$html_file" 2>/dev/null || echo 0)
        local file_size_mb=$((file_size / 1024 / 1024))
        
        log_debug "Validating HTML file: $rel_path ($file_size bytes)"
        
        # Check file size
        if [[ $file_size_mb -gt $MAX_SINGLE_FILE_MB ]]; then
            html_issues+=("$rel_path: File too large (${file_size_mb}MB > ${MAX_SINGLE_FILE_MB}MB)")
        fi
        
        # Check basic HTML structure
        if ! grep -q "<!DOCTYPE" "$html_file"; then
            html_issues+=("$rel_path: Missing DOCTYPE declaration")
        fi
        
        if ! grep -q "<html" "$html_file"; then
            html_issues+=("$rel_path: Missing HTML tag")
        fi
        
        if ! grep -q "<head>" "$html_file"; then
            html_issues+=("$rel_path: Missing HEAD section")
        fi
        
        if ! grep -q "<body>" "$html_file"; then
            html_issues+=("$rel_path: Missing BODY section")
        fi
        
        # Check for meta tags important for Walrus Sites
        local has_charset=$(grep -q 'charset=' "$html_file" && echo true || echo false)
        local has_viewport=$(grep -q 'name="viewport"' "$html_file" && echo true || echo false)
        local has_title=$(grep -q '<title>' "$html_file" && echo true || echo false)
        
        # Check for relative paths (important for Walrus Sites)
        local absolute_paths=$(grep -c 'src="http' "$html_file" || echo 0)
        local absolute_hrefs=$(grep -c 'href="http' "$html_file" || echo 0)
        
        # Store file details
        html_details=$(echo "$html_details" | jq --arg path "$rel_path" \
                                                --arg size "$file_size" \
                                                --argjson charset "$has_charset" \
                                                --argjson viewport "$has_viewport" \
                                                --argjson title "$has_title" \
                                                --arg abs_paths "$absolute_paths" \
                                                --arg abs_hrefs "$absolute_hrefs" \
                                                '.files[$path] = {
                                                  "size_bytes": ($size | tonumber),
                                                  "has_charset": $charset,
                                                  "has_viewport": $viewport,
                                                  "has_title": $title,
                                                  "absolute_src_paths": ($abs_paths | tonumber),
                                                  "absolute_href_paths": ($abs_hrefs | tonumber)
                                                }')
        
        # Warnings for missing meta tags
        if [[ "$has_charset" == "false" ]]; then
            html_issues+=("$rel_path: Missing charset meta tag")
        fi
        
        if [[ "$has_viewport" == "false" ]]; then
            html_issues+=("$rel_path: Missing viewport meta tag")
        fi
        
        if [[ "$has_title" == "false" ]]; then
            html_issues+=("$rel_path: Missing title tag")
        fi
        
        # Check for potential Walrus Sites issues
        if [[ $absolute_paths -gt 0 ]] || [[ $absolute_hrefs -gt 0 ]]; then
            html_issues+=("$rel_path: Contains absolute URLs that may not work on Walrus Sites")
        fi
    done
    
    # Report results
    if [[ ${#html_issues[@]} -gt 0 ]]; then
        local issues_text=$(printf '%s\n' "${html_issues[@]}")
        update_report "html_validation" "warning" "HTML validation issues found" "$html_details"
        log_warning "HTML validation issues:"
        printf '%s\n' "${html_issues[@]}" | while read -r issue; do
            log_warning "  - $issue"
        done
        add_recommendation "Fix HTML validation issues to ensure proper rendering on Walrus Sites"
    else
        update_report "html_validation" "pass" "All HTML files are valid" "$html_details"
        log_success "HTML validation passed"
    fi
    
    return 0
}

# Validate CSS and JavaScript files
validate_assets() {
    log_info "Validating CSS and JavaScript assets..."
    
    local css_files=()
    local js_files=()
    local asset_issues=()
    local asset_details="{}"
    
    # Find CSS files
    while IFS= read -r -d '' file; do
        css_files+=("$file")
    done < <(find "$BUILD_DIR" -name "*.css" -type f -print0)
    
    # Find JS files
    while IFS= read -r -d '' file; do
        js_files+=("$file")
    done < <(find "$BUILD_DIR" -name "*.js" -type f -print0)
    
    log_debug "Found ${#css_files[@]} CSS files and ${#js_files[@]} JS files"
    
    # Validate CSS files
    local total_css_size=0
    for css_file in "${css_files[@]}"; do
        local rel_path="${css_file#$BUILD_DIR/}"
        local file_size=$(stat -f%z "$css_file" 2>/dev/null || stat -c%s "$css_file" 2>/dev/null || echo 0)
        local file_size_mb=$((file_size / 1024 / 1024))
        total_css_size=$((total_css_size + file_size))
        
        # Check file size
        if [[ $file_size_mb -gt $MAX_SINGLE_FILE_MB ]]; then
            asset_issues+=("CSS $rel_path: File too large (${file_size_mb}MB)")
        fi
        
        # Basic CSS syntax check
        if ! grep -q '{.*}' "$css_file" 2>/dev/null; then
            asset_issues+=("CSS $rel_path: Invalid CSS syntax or empty file")
        fi
        
        # Check for absolute URLs in CSS
        local absolute_urls=$(grep -c 'url(http' "$css_file" 2>/dev/null || echo 0)
        if [[ $absolute_urls -gt 0 ]]; then
            asset_issues+=("CSS $rel_path: Contains absolute URLs that may not work on Walrus Sites")
        fi
        
        asset_details=$(echo "$asset_details" | jq --arg path "$rel_path" \
                                                   --arg size "$file_size" \
                                                   --arg abs_urls "$absolute_urls" \
                                                   '.css_files[$path] = {
                                                     "size_bytes": ($size | tonumber),
                                                     "absolute_urls": ($abs_urls | tonumber)
                                                   }')
    done
    
    # Validate JS files
    local total_js_size=0
    for js_file in "${js_files[@]}"; do
        local rel_path="${js_file#$BUILD_DIR/}"
        local file_size=$(stat -f%z "$js_file" 2>/dev/null || stat -c%s "$js_file" 2>/dev/null || echo 0)
        local file_size_mb=$((file_size / 1024 / 1024))
        total_js_size=$((total_js_size + file_size))
        
        # Check file size
        if [[ $file_size_mb -gt $MAX_SINGLE_FILE_MB ]]; then
            asset_issues+=("JS $rel_path: File too large (${file_size_mb}MB)")
        fi
        
        # Check for common JS patterns (basic validation)
        if [[ $file_size -gt 100 ]] && ! grep -q -E '(function|var|let|const|=>)' "$js_file" 2>/dev/null; then
            asset_issues+=("JS $rel_path: Potentially invalid JavaScript")
        fi
        
        asset_details=$(echo "$asset_details" | jq --arg path "$rel_path" \
                                                   --arg size "$file_size" \
                                                   '.js_files[$path] = {
                                                     "size_bytes": ($size | tonumber)
                                                   }')
    done
    
    # Calculate asset summary
    local total_css_mb=$((total_css_size / 1024 / 1024))
    local total_js_mb=$((total_js_size / 1024 / 1024))
    
    asset_details=$(echo "$asset_details" | jq --arg css_count "${#css_files[@]}" \
                                               --arg js_count "${#js_files[@]}" \
                                               --arg css_size "$total_css_size" \
                                               --arg js_size "$total_js_size" \
                                               '.summary = {
                                                 "css_files_count": ($css_count | tonumber),
                                                 "js_files_count": ($js_count | tonumber),
                                                 "total_css_size_bytes": ($css_size | tonumber),
                                                 "total_js_size_bytes": ($js_size | tonumber)
                                               }')
    
    # Report results
    if [[ ${#asset_issues[@]} -gt 0 ]]; then
        update_report "asset_validation" "warning" "Asset validation issues found" "$asset_details"
        log_warning "Asset validation issues:"
        printf '%s\n' "${asset_issues[@]}" | while read -r issue; do
            log_warning "  - $issue"
        done
    else
        update_report "asset_validation" "pass" "All assets are valid" "$asset_details"
        log_success "Asset validation passed"
    fi
    
    log_info "Asset summary: ${#css_files[@]} CSS files (${total_css_mb}MB), ${#js_files[@]} JS files (${total_js_mb}MB)"
    
    return 0
}

# Validate build size and performance
validate_performance() {
    log_info "Validating build size and performance metrics..."
    
    local total_size=$(du -sk "$BUILD_DIR" | cut -f1)
    local total_size_mb=$((total_size / 1024))
    local file_count=$(find "$BUILD_DIR" -type f | wc -l)
    local max_depth=$(find "$BUILD_DIR" -type d -exec sh -c 'echo "${1#'"$BUILD_DIR"'}" | tr -cd "/" | wc -c' _ {} \; | sort -n | tail -1)
    
    local performance_details=$(jq -n --arg size_kb "$total_size" \
                                      --arg size_mb "$total_size_mb" \
                                      --arg file_count "$file_count" \
                                      --arg max_depth "$max_depth" \
                                      '{
                                        "total_size_kb": ($size_kb | tonumber),
                                        "total_size_mb": ($size_mb | tonumber),
                                        "file_count": ($file_count | tonumber),
                                        "max_nesting_depth": ($max_depth | tonumber)
                                      }')
    
    local perf_issues=()
    
    # Check total build size
    if [[ $total_size_mb -gt $MAX_BUILD_SIZE_MB ]]; then
        perf_issues+=("Build size too large: ${total_size_mb}MB > ${MAX_BUILD_SIZE_MB}MB")
        add_recommendation "Optimize build size by compressing assets, removing unused files, or implementing code splitting" "high"
    fi
    
    # Check nesting depth
    if [[ $max_depth -gt $MAX_NESTING_DEPTH ]]; then
        perf_issues+=("Directory nesting too deep: $max_depth > $MAX_NESTING_DEPTH")
        add_recommendation "Reduce directory nesting depth to improve Walrus Sites compatibility" "medium"
    fi
    
    # Find largest files
    local largest_files=$(find "$BUILD_DIR" -type f -exec du -k {} \; | sort -rn | head -10)
    local largest_files_json="[]"
    while read -r size path; do
        local rel_path="${path#$BUILD_DIR/}"
        local size_mb=$((size / 1024))
        largest_files_json=$(echo "$largest_files_json" | jq --arg path "$rel_path" --arg size "$size" --arg size_mb "$size_mb" '. += [{"path": $path, "size_kb": ($size | tonumber), "size_mb": ($size_mb | tonumber)}]')
    done <<< "$largest_files"
    
    performance_details=$(echo "$performance_details" | jq --argjson largest "$largest_files_json" '.largest_files = $largest')
    
    # Report results
    if [[ ${#perf_issues[@]} -gt 0 ]]; then
        local issues_text=$(printf '%s\n' "${perf_issues[@]}")
        update_report "performance" "warning" "Performance issues found: $issues_text" "$performance_details"
        log_warning "Performance validation issues:"
        printf '%s\n' "${perf_issues[@]}" | while read -r issue; do
            log_warning "  - $issue"
        done
    else
        update_report "performance" "pass" "Performance validation passed" "$performance_details"
        log_success "Performance validation passed"
    fi
    
    log_info "Performance summary: ${total_size_mb}MB total, $file_count files, max depth $max_depth"
    
    # Store performance metrics in report
    local temp_file=$(mktemp)
    jq --argjson perf "$performance_details" '.performance_metrics = $perf' "$VALIDATION_REPORT" > "$temp_file"
    mv "$temp_file" "$VALIDATION_REPORT"
    
    return 0
}

# Validate Walrus Sites specific requirements
validate_walrus_compatibility() {
    log_info "Validating Walrus Sites compatibility..."
    
    local compat_issues=()
    local compat_details="{}"
    
    # Check for SPA routing compatibility
    local spa_routes=()
    while IFS= read -r -d '' dir; do
        if [[ -f "$dir/index.html" ]]; then
            local route="${dir#$BUILD_DIR}"
            spa_routes+=("$route")
        fi
    done < <(find "$BUILD_DIR" -type d -print0)
    
    compat_details=$(echo "$compat_details" | jq --argjson routes "$(printf '%s\n' "${spa_routes[@]}" | jq -R . | jq -s .)" '.spa_routes = $routes')
    
    # Check for Next.js specific files that might cause issues
    local nextjs_files=(
        "_next/static"
        "_next/server"
        "api"
    )
    
    local found_nextjs_files=()
    for next_file in "${nextjs_files[@]}"; do
        if [[ -e "$BUILD_DIR/$next_file" ]]; then
            found_nextjs_files+=("$next_file")
        fi
    done
    
    compat_details=$(echo "$compat_details" | jq --argjson files "$(printf '%s\n' "${found_nextjs_files[@]}" | jq -R . | jq -s .)" '.nextjs_files = $files')
    
    # Check for proper 404 handling
    if [[ ! -f "$BUILD_DIR/404.html" ]] && [[ ! -f "$BUILD_DIR/404/index.html" ]]; then
        compat_issues+=("Missing 404 error page - may cause issues with broken links on Walrus Sites")
    fi
    
    # Check for service worker compatibility
    local has_service_worker=false
    if [[ -f "$BUILD_DIR/sw.js" ]] || [[ -f "$BUILD_DIR/service-worker.js" ]]; then
        has_service_worker=true
        # Check if service worker uses relative paths
        local sw_file=""
        [[ -f "$BUILD_DIR/sw.js" ]] && sw_file="$BUILD_DIR/sw.js"
        [[ -f "$BUILD_DIR/service-worker.js" ]] && sw_file="$BUILD_DIR/service-worker.js"
        
        if [[ -n "$sw_file" ]]; then
            local absolute_urls_in_sw=$(grep -c 'http[s]\?://' "$sw_file" 2>/dev/null || echo 0)
            if [[ $absolute_urls_in_sw -gt 0 ]]; then
                compat_issues+=("Service worker contains absolute URLs that may not work on Walrus Sites")
            fi
        fi
    fi
    
    compat_details=$(echo "$compat_details" | jq --argjson has_sw "$has_service_worker" '.has_service_worker = $has_sw')
    
    # Check for manifest.json validity
    if [[ -f "$BUILD_DIR/manifest.json" ]]; then
        if ! jq empty "$BUILD_DIR/manifest.json" >/dev/null 2>&1; then
            compat_issues+=("manifest.json is not valid JSON")
        else
            # Check for required PWA fields
            local manifest_content=$(cat "$BUILD_DIR/manifest.json")
            local has_name=$(echo "$manifest_content" | jq -r '.name // empty' | grep -q . && echo true || echo false)
            local has_icons=$(echo "$manifest_content" | jq -r '.icons // empty | length' | grep -q '^[1-9]' && echo true || echo false)
            local has_start_url=$(echo "$manifest_content" | jq -r '.start_url // empty' | grep -q . && echo true || echo false)
            
            compat_details=$(echo "$compat_details" | jq --argjson name "$has_name" \
                                                         --argjson icons "$has_icons" \
                                                         --argjson start_url "$has_start_url" \
                                                         '.manifest = {
                                                           "has_name": $name,
                                                           "has_icons": $icons,
                                                           "has_start_url": $start_url
                                                         }')
            
            if [[ "$has_name" == "false" ]]; then
                compat_issues+=("manifest.json missing required 'name' field")
            fi
            
            if [[ "$has_start_url" == "false" ]]; then
                compat_issues+=("manifest.json missing 'start_url' field")
            fi
        fi
    fi
    
    # Check for potential CORS issues
    local has_headers_file=false
    if [[ -f "$BUILD_DIR/_headers" ]]; then
        has_headers_file=true
        # Check if _headers file has proper CORS setup
        if ! grep -q "Access-Control-Allow-Origin" "$BUILD_DIR/_headers" 2>/dev/null; then
            add_recommendation "Consider adding CORS headers to _headers file for better API compatibility" "low"
        fi
    fi
    
    compat_details=$(echo "$compat_details" | jq --argjson headers "$has_headers_file" '.has_headers_file = $headers')
    
    # Report results
    if [[ ${#compat_issues[@]} -gt 0 ]]; then
        local issues_text=$(printf '%s\n' "${compat_issues[@]}")
        update_report "walrus_compatibility" "warning" "Walrus Sites compatibility issues found" "$compat_details"
        log_warning "Walrus Sites compatibility issues:"
        printf '%s\n' "${compat_issues[@]}" | while read -r issue; do
            log_warning "  - $issue"
        done
    else
        update_report "walrus_compatibility" "pass" "Walrus Sites compatibility validation passed" "$compat_details"
        log_success "Walrus Sites compatibility validation passed"
    fi
    
    # Store compatibility info in report
    local temp_file=$(mktemp)
    jq --argjson compat "$compat_details" '.walrus_compatibility = $compat' "$VALIDATION_REPORT" > "$temp_file"
    mv "$temp_file" "$VALIDATION_REPORT"
    
    return 0
}

# Generate optimization suggestions
generate_optimizations() {
    log_info "Generating optimization suggestions..."
    
    # Analyze build patterns and suggest optimizations
    local large_images=$(find "$BUILD_DIR" -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" | xargs du -k 2>/dev/null | awk '$1 > 500 {print $2}' || true)
    
    if [[ -n "$large_images" ]]; then
        add_recommendation "Consider optimizing large images: $(echo "$large_images" | tr '\n' ' ')" "medium"
    fi
    
    # Check for duplicate files
    local duplicate_files=$(find "$BUILD_DIR" -type f -exec md5sum {} \; 2>/dev/null | sort | uniq -d -w32 | cut -d' ' -f3- || true)
    
    if [[ -n "$duplicate_files" ]]; then
        add_recommendation "Found potential duplicate files that could be deduplicated: $(echo "$duplicate_files" | tr '\n' ' ')" "low"
    fi
    
    # Check for uncompressed files
    local uncompressed_css=$(find "$BUILD_DIR" -name "*.css" -exec sh -c 'grep -l "  " "$1" >/dev/null 2>&1 && echo "$1"' _ {} \; | head -5 || true)
    
    if [[ -n "$uncompressed_css" ]]; then
        add_recommendation "Consider minifying CSS files for better performance" "medium"
    fi
    
    log_success "Optimization suggestions generated"
}

# Create recovery recommendations
create_recovery_plan() {
    log_info "Creating recovery plan for common issues..."
    
    # Read current validation status
    local critical_errors=$(jq -r '.summary.critical_errors' "$VALIDATION_REPORT")
    local errors=$(jq -r '.summary.errors' "$VALIDATION_REPORT")
    local warnings=$(jq -r '.summary.warnings' "$VALIDATION_REPORT")
    
    local recovery_plan="[]"
    
    if [[ $critical_errors -gt 0 ]]; then
        recovery_plan=$(echo "$recovery_plan" | jq '. += [{
          "type": "critical",
          "action": "rebuild",
          "description": "Critical errors detected. Rebuild the application with: pnpm run build",
          "commands": ["pnpm run clean", "pnpm run build"]
        }]')
    fi
    
    if [[ $errors -gt 0 ]]; then
        recovery_plan=$(echo "$recovery_plan" | jq '. += [{
          "type": "error",
          "action": "fix_assets",
          "description": "Asset errors detected. Check file integrity and regenerate if needed",
          "commands": ["find '$BUILD_DIR' -name '*.html' -exec html5validator {} \;"]
        }]')
    fi
    
    if [[ $warnings -gt 0 ]]; then
        recovery_plan=$(echo "$recovery_plan" | jq '. += [{
          "type": "warning",
          "action": "optimize",
          "description": "Optimization opportunities identified. Review recommendations section",
          "commands": ["pnpm run build:analyze"]
        }]')
    fi
    
    # Add general recovery steps
    recovery_plan=$(echo "$recovery_plan" | jq '. += [
      {
        "type": "general",
        "action": "clean_rebuild",
        "description": "If issues persist, perform a clean rebuild",
        "commands": ["rm -rf .next out node_modules/.cache", "pnpm install", "pnpm run build"]
      },
      {
        "type": "general",
        "action": "dependency_update",
        "description": "Update dependencies if compatibility issues are found",
        "commands": ["pnpm update", "pnpm run build"]
      }
    ]')
    
    # Store recovery plan in report
    local temp_file=$(mktemp)
    jq --argjson plan "$recovery_plan" '.recovery_plan = $plan' "$VALIDATION_REPORT" > "$temp_file"
    mv "$temp_file" "$VALIDATION_REPORT"
    
    log_success "Recovery plan created"
}

# Display validation summary
display_summary() {
    log_info "Validation Summary"
    log_info "=================="
    
    local total_checks=$(jq -r '.summary.total_checks' "$VALIDATION_REPORT")
    local passed=$(jq -r '.summary.passed' "$VALIDATION_REPORT")
    local warnings=$(jq -r '.summary.warnings' "$VALIDATION_REPORT")
    local errors=$(jq -r '.summary.errors' "$VALIDATION_REPORT")
    local critical_errors=$(jq -r '.summary.critical_errors' "$VALIDATION_REPORT")
    
    log_info "Total checks: $total_checks"
    log_success "Passed: $passed"
    
    if [[ $warnings -gt 0 ]]; then
        log_warning "Warnings: $warnings"
    fi
    
    if [[ $errors -gt 0 ]]; then
        log_error "Errors: $errors"
    fi
    
    if [[ $critical_errors -gt 0 ]]; then
        log_error "Critical errors: $critical_errors"
    fi
    
    # Display recommendations
    local recommendation_count=$(jq -r '.recommendations | length' "$VALIDATION_REPORT")
    if [[ $recommendation_count -gt 0 ]]; then
        log_info ""
        log_info "Recommendations:"
        jq -r '.recommendations[] | "  - \(.message) (\(.priority) priority)"' "$VALIDATION_REPORT"
    fi
    
    log_info ""
    log_info "Detailed report saved to: $VALIDATION_REPORT"
    
    # Return appropriate exit code
    if [[ $critical_errors -gt 0 ]]; then
        return 2
    elif [[ $errors -gt 0 ]]; then
        return 1
    else
        return 0
    fi
}

# Main execution
main() {
    log_info "Enhanced Build Validation for Walrus Sites"
    log_info "=========================================="
    
    # Check prerequisites
    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed. Please install jq first."
        exit 1
    fi
    
    # Initialize validation report
    init_validation_report
    
    # Run validation checks
    local exit_code=0
    
    validate_build_exists || exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        validate_essential_files || true
        validate_html_files || true
        validate_assets || true
        validate_performance || true
        validate_walrus_compatibility || true
        generate_optimizations || true
        create_recovery_plan || true
    fi
    
    # Display summary and return appropriate exit code
    display_summary
    exit $?
}

# Handle command line arguments
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    cat << EOF
Enhanced Build Validation for Walrus Sites

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --help, -h          Show this help message
    --debug             Enable debug output
    --build-dir DIR     Override build directory (default: ./out)

DESCRIPTION:
    Performs comprehensive validation of Next.js static export output
    for Walrus Sites compatibility, including:
    
    - Essential file validation
    - HTML/CSS/JS integrity checks
    - Performance and size analysis
    - Walrus Sites specific compatibility
    - Optimization recommendations
    - Recovery plan generation

EXAMPLES:
    $0                  # Basic validation
    $0 --debug          # Validation with debug output
    DEBUG=true $0       # Alternative debug mode

EOF
    exit 0
fi

# Handle debug flag
if [[ "${1:-}" == "--debug" ]]; then
    export DEBUG=true
    shift
fi

# Handle build directory override
if [[ "${1:-}" == "--build-dir" ]]; then
    BUILD_DIR="$2"
    shift 2
fi

# Run main function
main "$@"