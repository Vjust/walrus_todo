/**
 * Waltodo CLI - Completion command
 * Generates shell completion scripts for various shells
 */

import { Command } from 'commander';
import { error, info } from '../../ui';

/**
 * Register the completion command
 */
export function completionCommand(program: Command): void {
  program
    .command('completion')
    .description('Generate shell completion scripts')
    .option('--shell <shell>', 'Shell type (bash, zsh, fish)', 'bash')
    .action((options) => {
      generateCompletion(options.shell);
    });
}

/**
 * Generate shell completion script
 */
function generateCompletion(shell: string): void {
  const completions = {
    bash: `
# Waltodo Bash Completion
_waltodo() {
    local cur prev commands
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    commands="add list ls done delete rm clear export import search find stats publish blobs list-blobs blob-status fetch download blob-stats delete-blob discover completion -i --interactive --no-sync --offline --debug --help --version"
    
    if [[ \${cur} == -* ]]; then
        COMPREPLY=( \$(compgen -W "--interactive --no-sync --offline --debug --help --version" -- \${cur}) )
        return 0
    fi
    
    COMPREPLY=( \$(compgen -W "\${commands}" -- \${cur}) )
    return 0
}
complete -F _waltodo waltodo
`,
    zsh: `
# Waltodo Zsh Completion
_waltodo() {
    local state
    _arguments \
        '(-i --interactive)'{-i,--interactive}'[Start interactive mode]' \
        '--no-sync[Disable automatic synchronization]' \
        '--offline[Work in offline mode only]' \
        '--debug[Enable debug logging]' \
        '--config[Use custom config file]:path:_files' \
        '--data-dir[Use custom data directory]:path:_directories' \
        '*::command:->commands'
    
    case \$state in
        commands)
            _values 'commands' \
                'add[Add a new TODO item]' \
                'list[List all TODO items]' \
                'ls[List all TODO items]' \
                'done[Mark a TODO item as done]' \
                'delete[Delete a TODO item]' \
                'rm[Delete a TODO item]' \
                'clear[Clear all TODO items]' \
                'export[Export TODOs to a JSON file]' \
                'import[Import TODOs from a JSON file]' \
                'search[Search TODOs by text]' \
                'find[Search TODOs by text]' \
                'stats[Show TODO statistics]' \
                'publish[Publish TODOs to Walrus]' \
                'blobs[List published blobs]' \
                'list-blobs[List published blobs]' \
                'blob-status[Check blob status]' \
                'fetch[Fetch TODOs from Walrus blobs]' \
                'download[Download TODOs from a specific blob]' \
                'blob-stats[Show blob statistics]' \
                'delete-blob[Delete a blob from tracking]' \
                'discover[Discover all your TODO blobs on Walrus]' \
                'completion[Generate shell completion scripts]'
            ;;
    esac
}
compdef _waltodo waltodo
`,
    fish: `
# Waltodo Fish Completion
complete -c waltodo -s i -l interactive -d "Start interactive mode"
complete -c waltodo -l no-sync -d "Disable automatic synchronization"
complete -c waltodo -l offline -d "Work in offline mode only"
complete -c waltodo -l debug -d "Enable debug logging"
complete -c waltodo -l config -d "Use custom config file" -r
complete -c waltodo -l data-dir -d "Use custom data directory" -r

complete -c waltodo -f -a "add" -d "Add a new TODO item"
complete -c waltodo -f -a "list" -d "List all TODO items"
complete -c waltodo -f -a "ls" -d "List all TODO items"
complete -c waltodo -f -a "done" -d "Mark a TODO item as done"
complete -c waltodo -f -a "delete" -d "Delete a TODO item"
complete -c waltodo -f -a "rm" -d "Delete a TODO item"
complete -c waltodo -f -a "clear" -d "Clear all TODO items"
complete -c waltodo -f -a "export" -d "Export TODOs to a JSON file"
complete -c waltodo -f -a "import" -d "Import TODOs from a JSON file"
complete -c waltodo -f -a "search" -d "Search TODOs by text"
complete -c waltodo -f -a "find" -d "Search TODOs by text"
complete -c waltodo -f -a "stats" -d "Show TODO statistics"
complete -c waltodo -f -a "publish" -d "Publish TODOs to Walrus"
complete -c waltodo -f -a "blobs" -d "List published blobs"
complete -c waltodo -f -a "list-blobs" -d "List published blobs"
complete -c waltodo -f -a "blob-status" -d "Check blob status"
complete -c waltodo -f -a "fetch" -d "Fetch TODOs from Walrus blobs"
complete -c waltodo -f -a "download" -d "Download TODOs from a specific blob"
complete -c waltodo -f -a "blob-stats" -d "Show blob statistics"
complete -c waltodo -f -a "delete-blob" -d "Delete a blob from tracking"
complete -c waltodo -f -a "discover" -d "Discover all your TODO blobs on Walrus"
complete -c waltodo -f -a "completion" -d "Generate shell completion scripts"
`
  };

  const script = completions[shell as keyof typeof completions];
  if (!script) {
    error(`Unsupported shell: ${shell}. Supported shells: bash, zsh, fish`);
    return;
  }

  console.log(script);
  info(`To enable completion, add the above to your shell's configuration file:`);
  info(`  Bash: ~/.bashrc or ~/.bash_profile`);
  info(`  Zsh: ~/.zshrc`);
  info(`  Fish: ~/.config/fish/completions/waltodo.fish`);
}