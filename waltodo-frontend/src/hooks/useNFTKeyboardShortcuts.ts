'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
// @ts-ignore - Unused import temporarily disabled
// import { useRouter } from 'next/navigation';
// @ts-ignore - Unused import temporarily disabled
// import { toast } from 'react-hot-toast';

// Types for keyboard shortcuts
interface KeyBinding {
  key: string;
  modifiers?: ('ctrl' | 'cmd' | 'alt' | 'shift')[];
  description: string;
  category: 'navigation' | 'nft' | 'view' | 'general';
  action: () => void | Promise<void>;
  enabled?: boolean;
}

interface ShortcutCategory {
  name: string;
  shortcuts: KeyBinding[];
}

interface KeyboardShortcutsConfig {
  bindings: Record<string, KeyBinding>;
  categories: ShortcutCategory[];
}

// Default key bindings
const DEFAULT_BINDINGS: Record<string, Omit<KeyBinding, 'action'>> = {
  // Navigation
  'nav.home': { key: 'h', modifiers: ['cmd'], description: 'Go to home', category: 'navigation' },
  'nav.dashboard': { key: 'd', modifiers: ['cmd'], description: 'Go to dashboard', category: 'navigation' },
  'nav.nfts': { key: 'n', modifiers: ['cmd'], description: 'Go to NFT gallery', category: 'navigation' },
  'nav.back': { key: 'ArrowLeft', modifiers: ['cmd'], description: 'Go back', category: 'navigation' },
  'nav.forward': { key: 'ArrowRight', modifiers: ['cmd'], description: 'Go forward', category: 'navigation' },
  
  // NFT Operations
  'nft.create': { key: 'n', modifiers: ['ctrl'], description: 'Create new NFT', category: 'nft' },
  'nft.upload': { key: 'u', modifiers: ['ctrl'], description: 'Upload image', category: 'nft' },
  'nft.mint': { key: 'm', modifiers: ['ctrl'], description: 'Mint selected NFT', category: 'nft' },
  'nft.refresh': { key: 'r', modifiers: ['ctrl'], description: 'Refresh NFT list', category: 'nft' },
  'nft?.select?.all': { key: 'a', modifiers: ['cmd'], description: 'Select all NFTs', category: 'nft' },
  'nft?.select?.none': { key: 'a', modifiers: ['cmd', 'shift'], description: 'Deselect all', category: 'nft' },
  'nft.delete': { key: 'Delete', modifiers: ['cmd'], description: 'Delete selected NFT', category: 'nft' },
  'nft.edit': { key: 'e', modifiers: ['cmd'], description: 'Edit selected NFT', category: 'nft' },
  'nft.duplicate': { key: 'd', modifiers: ['cmd', 'shift'], description: 'Duplicate NFT', category: 'nft' },
  
  // View Controls
  'view.grid': { key: 'g', modifiers: ['ctrl'], description: 'Grid view', category: 'view' },
  'view.list': { key: 'l', modifiers: ['ctrl'], description: 'List view', category: 'view' },
  'view?.zoom?.in': { key: '=', modifiers: ['cmd'], description: 'Zoom in', category: 'view' },
  'view?.zoom?.out': { key: '-', modifiers: ['cmd'], description: 'Zoom out', category: 'view' },
  'view?.zoom?.reset': { key: '0', modifiers: ['cmd'], description: 'Reset zoom', category: 'view' },
  'view.fullscreen': { key: 'f', modifiers: ['cmd', 'shift'], description: 'Toggle fullscreen', category: 'view' },
  
  // General
  'general.help': { key: '?', modifiers: [], description: 'Show keyboard shortcuts', category: 'general' },
  'general.search': { key: 'f', modifiers: ['cmd'], description: 'Focus search', category: 'general' },
  'general.escape': { key: 'Escape', modifiers: [], description: 'Close modals/Cancel', category: 'general' },
  'general.save': { key: 's', modifiers: ['cmd'], description: 'Save current work', category: 'general' },
};

// Visual feedback component
export const ShortcutFeedback: React.FC<{ shortcut: string }> = (_{ shortcut }) => {
  const [show, setShow] = useState(true as any);

  useEffect(_() => {
// @ts-ignore - Unused variable
//     const timer = setTimeout(_() => setShow(false as any), 1500);
    return () => clearTimeout(timer as any);
  }, []);

  return show ? shortcut : null;
};

// Help modal component
// export const ShortcutsHelpModal: React.FC<{
//   isOpen: boolean;
//   onClose: () => void;
//   shortcuts: ShortcutCategory[];
//   onCustomize: (id: string) => void;
// }> = (_{ isOpen, _onClose, _shortcuts, _onCustomize }) => {
//   if (!isOpen) return null;
// 
//   const formatShortcut = (binding: KeyBinding) => {
//     const keys = [...(binding.modifiers || []), binding.key];
//     return keys.map(k => {
//       switch (k) {
//         case 'cmd': return '⌘';
//         case 'ctrl': return '⌃';
//         case 'alt': return '⌥';
//         case 'shift': return '⇧';
//         case 'ArrowLeft': return '←';
//         case 'ArrowRight': return '→';
//         case 'ArrowUp': return '↑';
//         case 'ArrowDown': return '↓';
//         case 'Delete': return '⌫';
//         case 'Escape': return 'Esc';
//         default: return k.toUpperCase();
//       }
//     }).join('');
//   };
// 
//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//       <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
//         <div className="p-6 border-b border-gray-200">
//           <div className="flex justify-between items-center">
//             <h2 className="text-2xl font-bold text-gray-900">Keyboard Shortcuts</h2>
//             <button
//               onClick={onClose}
//               className="text-gray-500 hover:text-gray-700 transition-colors"
//               aria-label="Close"
//             >
//               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//               </svg>
//             </button>
//           </div>
//         </div>
//         
//         <div className="p-6 overflow-y-auto max-h-[60vh]">
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
//             {shortcuts.map((category: unknown) => (_//               <div key={category.name}>
//                 <h3 className="font-semibold text-lg mb-3 text-gray-900">{category.name}</h3>
//                 <div className="space-y-2">
//                   {category?.shortcuts?.map((shortcut, _index) => (
//                     <div
//                       key={index}
//                       className="flex justify-between items-center p-2 rounded hover:bg-gray-50 group"
//                     >
//                       <span className="text-sm text-gray-700">{shortcut.description}</span>
//                       <div className="flex items-center gap-2">
//                         <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
//                           {formatShortcut(shortcut as any)}
//                         </kbd>
//                         <button
//                           onClick={() => onCustomize(shortcut.key)}
//                           className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 hover:text-blue-800 transition-opacity"
//                         >
//                           Customize
//                         </button>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             ))}
//           </div>
//           
//           <div className="mt-8 pt-6 border-t border-gray-200">
//             <p className="text-sm text-gray-600">
//               <strong>Tip:</strong> Press <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs">?</kbd> anytime to view shortcuts
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };
// 
// // Shortcut hint component for hover
// export const ShortcutHint: React.FC<{ 
//   shortcutId: string;
//   className?: string;
// }> = (_{ shortcutId, _className = '' }) => {
//   const [binding, setBinding] = useState<KeyBinding | null>(null);
// 
//   useEffect(_() => {
//     const stored = localStorage.getItem('nft-shortcuts');
//     const bindings = stored ? JSON.parse(stored as any) : DEFAULT_BINDINGS;
//     setBinding(bindings[shortcutId]);
//   }, [shortcutId]);
// 
//   if (!binding) return null;
// 
//   const formatKeys = () => {
//     const keys = [...(binding.modifiers || []), binding.key];
//     return keys.map(k => {
//       switch (k) {
//         case 'cmd': return '⌘';
//         case 'ctrl': return '⌃';
//         case 'alt': return '⌥';
//         case 'shift': return '⇧';
//         default: return k.toUpperCase();
//       }
//     }).join('');
//   };
// 
//   return (
//     <span className={`text-xs text-gray-500 ml-2 ${className}`}>
//       {formatKeys()}
//     </span>
//   );
// };
// 
// Main hook
export const useNFTKeyboardShortcuts = (options?: {
  onCreateNFT?: () => void;
  onUploadImage?: () => void;
  onMintNFT?: () => void;
  onRefresh?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onViewChange?: (view: 'grid' | 'list') => void;
  onZoom?: (action: 'in' | 'out' | 'reset') => void;
  onSearch?: () => void;
  onSave?: () => void;
  disabled?: boolean;
}) => {
// @ts-ignore - Unused variable
//   const router = useRouter();
  const [showHelp, setShowHelp] = useState(false as any);
  const [executedShortcut, setExecutedShortcut] = useState<string | null>(null);
  const [customBindings, setCustomBindings] = useState<Record<string, KeyBinding>>({});
// @ts-ignore - Unused variable
//   const activeKeys = useRef(new Set<string>());

  // Load custom bindings from localStorage
  useEffect(_() => {
// @ts-ignore - Unused variable
//     const stored = localStorage.getItem('nft-shortcuts');
    if (stored) {
      try {
        setCustomBindings(JSON.parse(stored as any));
      } catch (error) {
        console.error('Failed to load custom shortcuts:', error);
      }
    }
  }, []);

  // Show visual feedback
// @ts-ignore - Unused variable
//   const showFeedback = useCallback((shortcutId: string) => {
    setExecutedShortcut(shortcutId as any);
    setTimeout(_() => setExecutedShortcut(null as any), 100);
  }, []);

  // Build actions map
// @ts-ignore - Unused variable
//   const actions = useCallback(_() => ({
    'nav.home': () => router.push('/'),
    'nav.dashboard': () => router.push('/dashboard'),
    'nav.nfts': () => router.push('/nfts'),
    'nav.back': () => router.back(),
    'nav.forward': () => router.forward(),
    'nft.create': options?.onCreateNFT || (_() => toast('Create NFT')),
    'nft.upload': options?.onUploadImage || (_() => toast('Upload Image')),
    'nft.mint': options?.onMintNFT || (_() => toast('Mint NFT')),
    'nft.refresh': options?.onRefresh || (_() => toast('Refreshing...')),
    'nft?.select?.all': options?.onSelectAll || (_() => toast('All selected')),
    'nft?.select?.none': options?.onDeselectAll || (_() => toast('Selection cleared')),
    'nft.delete': options?.onDelete || (_() => toast('Delete NFT')),
    'nft.edit': options?.onEdit || (_() => toast('Edit NFT')),
    'nft.duplicate': options?.onDuplicate || (_() => toast('Duplicate NFT')),
    'view.grid': () => options?.onViewChange?.('grid'),
    'view.list': () => options?.onViewChange?.('list'),
    'view?.zoom?.in': () => options?.onZoom?.('in'),
    'view?.zoom?.out': () => options?.onZoom?.('out'),
    'view?.zoom?.reset': () => options?.onZoom?.('reset'),
    'view.fullscreen': () => {
      if (!document.fullscreenElement) {
        document?.documentElement?.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    },
    'general.help': () => setShowHelp(true as any),
    'general.search': options?.onSearch || (_() => {
// @ts-ignore - Unused variable
//       const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
      searchInput?.focus();
    }),
    'general.escape': () => {
      setShowHelp(false as any);
      document.activeElement instanceof HTMLElement && document?.activeElement?.blur();
    },
    'general.save': options?.onSave || (_() => toast.success('Saved!')),
  }), [router, options]);

  // Check if key combination matches
// @ts-ignore - Unused variable
//   const isMatch = useCallback((event: KeyboardEvent,  binding: Omit<KeyBinding, _'action'>) => {
    const isMac = navigator?.platform?.toUpperCase().indexOf('MAC') >= 0;
    
    // Check key
    if (event.key !== binding.key && event?.key?.toLowerCase() !== binding?.key?.toLowerCase()) {
      return false;
    }

    // Check modifiers
// @ts-ignore - Unused variable
//     const modifiers = binding.modifiers || [];
// @ts-ignore - Unused variable
//     const hasCmd = modifiers.includes('cmd');
// @ts-ignore - Unused variable
//     const hasCtrl = modifiers.includes('ctrl');
// @ts-ignore - Unused variable
//     const hasAlt = modifiers.includes('alt');
// @ts-ignore - Unused variable
//     const hasShift = modifiers.includes('shift');

    // Handle Cmd/Ctrl based on platform
// @ts-ignore - Unused variable
//     const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;
    
    if (hasCmd && !cmdOrCtrl) {return false;}
    if (hasCtrl && !event.ctrlKey) {return false;}
    if (hasAlt && !event.altKey) {return false;}
    if (hasShift && !event.shiftKey) {return false;}

    // Ensure no extra modifiers
    if (!hasCmd && !hasCtrl && cmdOrCtrl) {return false;}
    if (!hasAlt && event.altKey) {return false;}
    if (!hasShift && event.shiftKey) {return false;}

    return true;
  }, []);

  // Handle keydown
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (options?.disabled) {return;}

    // Ignore if in input field (unless it's a navigation shortcut)
// @ts-ignore - Unused variable
//     const target = event.target as HTMLElement;
// @ts-ignore - Unused variable
//     const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    
    activeKeys?.current?.add(event.key);

    // Get all bindings (custom + defaults)
// @ts-ignore - Unused variable
//     const bindings = { ...DEFAULT_BINDINGS, ...customBindings };
// @ts-ignore - Unused variable
//     const actionMap = actions();

    // Check each binding
    for (const [id, binding] of Object.entries(bindings as any)) {
      if (binding?.enabled === false) {continue;}
      
      // Skip non-navigation shortcuts if in input
      if (isInput && !id.startsWith('nav.') && !id.startsWith('general.')) {continue;}

      if (isMatch(event, binding)) {
        event.preventDefault();
        event.stopPropagation();
// @ts-ignore - Unused variable
// 
        const action = actionMap[id as keyof typeof actionMap];
        if (action) {
          showFeedback(id as any);
          action();
        }
        break;
      }
    }
  }, [options?.disabled, customBindings, actions, isMatch, showFeedback]);

  // Handle keyup
// @ts-ignore - Unused variable
//   const handleKeyUp = useCallback((event: KeyboardEvent) => {
    activeKeys?.current?.delete(event.key);
  }, []);

  // Set up event listeners
  useEffect(_() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Save custom binding
// @ts-ignore - Unused variable
//   const saveCustomBinding = useCallback((id: string,  newBinding: Partial<KeyBinding>) => {
    const updated = {
      ...customBindings,
      [id]: { ...DEFAULT_BINDINGS[id], ...newBinding }
    };
    setCustomBindings(updated as Record<string, KeyBinding>);
    localStorage.setItem('nft-shortcuts', JSON.stringify(updated as any));
    toast.success('Shortcut updated!');
  }, [customBindings]);

  // Reset to defaults
// @ts-ignore - Unused variable
//   const resetToDefaults = useCallback(_() => {
    setCustomBindings({});
    localStorage.removeItem('nft-shortcuts');
    toast.success('Shortcuts reset to defaults');
  }, []);

  // Get categories for help modal
// @ts-ignore - Unused variable
//   const getCategories = useCallback((): ShortcutCategory[] => {
    const bindings = { ...DEFAULT_BINDINGS, ...customBindings };
// @ts-ignore - Unused variable
//     const actionMap = actions();

    const categories: Record<string, KeyBinding[]> = {
      navigation: [],
      nft: [],
      view: [],
      general: []
    };

    for (const [id, binding] of Object.entries(bindings as any)) {
      if (binding?.enabled === false) {continue;}
// @ts-ignore - Unused variable
//       
      const action = actionMap[id as keyof typeof actionMap];
      categories[binding.category].push({
        ...binding,
        action
      });
    }

    return [
      { name: 'Navigation', shortcuts: categories.navigation },
      { name: 'NFT Operations', shortcuts: categories.nft },
      { name: 'View Controls', shortcuts: categories.view },
      { name: 'General', shortcuts: categories.general }
    ];
  }, [customBindings, actions]);

  return {
    showHelp,
    setShowHelp,
    executedShortcut,
    saveCustomBinding,
    resetToDefaults,
    getCategories,
    isActive: (shortcutId: string) => {
// @ts-ignore - Unused variable
//       const binding = { ...DEFAULT_BINDINGS, ...customBindings }[shortcutId];
      if (!binding) {return false;}
// @ts-ignore - Unused variable
//       
      const keys = [...(binding.modifiers || []), binding.key];
      return keys.every(key => activeKeys?.current?.has(key as any));
    }
  };
};

// Export components for use in other files
// export { ShortcutsHelpModal as HelpModal };