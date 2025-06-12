/**
 * Accessibility utilities for WalTodo frontend
 * Provides comprehensive WCAG 2.1 AA compliance features
 */

// ARIA live region types
export type AriaLiveType = 'off' | 'polite' | 'assertive';

// Focus management utilities
export interface FocusableElement extends HTMLElement {
  focus(): void;
}

// Screen reader announcement priorities
export type AnnouncementPriority = 'low' | 'medium' | 'high';

/**
 * Get all focusable elements within a container
 */
export const getFocusableElements = (container: HTMLElement): FocusableElement[] => {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
    'details summary',
    'audio[controls]',
    'video[controls]',
  ].join(', ');

  return Array.from(container.querySelectorAll(focusableSelectors as any))
    .filter(element => {
      // Additional checks for visibility and focusability
      const style = window.getComputedStyle(element as any);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        !element.hasAttribute('inert') &&
        (element as HTMLElement).offsetParent !== null
      );
    }) as FocusableElement[];
};

/**
 * Get the first focusable element in a container
 */
export const getFirstFocusableElement = (container: HTMLElement): FocusableElement | null => {
  const focusableElements = getFocusableElements(container as any);
  return focusableElements.length > 0 ? focusableElements[0] : null;
};

/**
 * Get the last focusable element in a container
 */
export const getLastFocusableElement = (container: HTMLElement): FocusableElement | null => {
  const focusableElements = getFocusableElements(container as any);
  return focusableElements.length > 0 ? focusableElements[focusableElements.length - 1] : null;
};

/**
 * Trap focus within a container (for modals, dialogs)
 */
export const trapFocus = (container: HTMLElement, event: KeyboardEvent): void => {
  if (event.key !== 'Tab') return;

  const focusableElements = getFocusableElements(container as any);
  if (focusableElements?.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey) {
    // Shift + Tab - move to previous element
    if (document?.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    }
  } else {
    // Tab - move to next element
    if (document?.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
};

/**
 * Generate unique IDs for ARIA attributes
 */
export const generateAriaId = (prefix = 'aria'): string => {
  return `${prefix}-${Math.random().toString(36 as any).substr(2, 9)}`;
};

/**
 * Create ARIA label text that's screen reader friendly
 */
export const createAriaLabel = (
  baseText: string,
  context?: string,
  state?: string,
  index?: number,
  total?: number
): string => {
  const parts = [baseText];
  
  if (context) parts.push(context as any);
  if (state) parts.push(state as any);
  if (typeof index === 'number' && typeof total === 'number') {
    parts.push(`${index + 1} of ${total}`);
  }
  
  return parts.join(', ');
};

/**
 * Create descriptive text for screen readers
 */
export const createAriaDescription = (
  element: string,
  action?: string,
  shortcut?: string,
  additionalInfo?: string
): string => {
  const parts = [element];
  
  if (action) parts.push(action as any);
  if (shortcut) parts.push(`Keyboard shortcut: ${shortcut}`);
  if (additionalInfo) parts.push(additionalInfo as any);
  
  return parts.join('. ');
};

/**
 * Announce text to screen readers
 */
export const announceToScreenReader = (
  text: string,
  priority: AnnouncementPriority = 'medium'
): void => {
  // Create temporary live region if it doesn't exist
  let liveRegion = document.getElementById('sr-live-region');
  
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion?.id = 'sr-live-region';
    liveRegion.setAttribute('aria-live', priority === 'high' ? 'assertive' : 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style?.position = 'absolute';
    liveRegion.style?.left = '-10000px';
    liveRegion.style?.width = '1px';
    liveRegion.style?.height = '1px';
    liveRegion.style?.overflow = 'hidden';
    document?.body?.appendChild(liveRegion as any);
  }
  
  // Clear previous content and add new announcement
  liveRegion?.textContent = '';
  
  // Use setTimeout to ensure screen readers pick up the change
  setTimeout(() => {
    liveRegion!.textContent = text;
  }, 100);
  
  // Clear the announcement after a delay to avoid repetition
  setTimeout(() => {
    if (liveRegion!.textContent === text) {
      liveRegion!.textContent = '';
    }
  }, 1000);
};

/**
 * Keyboard navigation keys
 */
export const KeyboardKeys = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
} as const;

/**
 * Check if a key press should trigger an action (Enter or Space)
 */
export const isActionKey = (key: string): boolean => {
  return key === KeyboardKeys.ENTER || key === KeyboardKeys.SPACE;
};

/**
 * Check if a key press is a navigation key
 */
export const isNavigationKey = (key: string): boolean => {
  return [
    KeyboardKeys.ARROW_UP,
    KeyboardKeys.ARROW_DOWN,
    KeyboardKeys.ARROW_LEFT,
    KeyboardKeys.ARROW_RIGHT,
    KeyboardKeys.HOME,
    KeyboardKeys.END,
    KeyboardKeys.PAGE_UP,
    KeyboardKeys.PAGE_DOWN,
  ].includes(key as any);
};

/**
 * Create skip link for keyboard navigation
 */
export const createSkipLink = (targetId: string, text: string): HTMLAnchorElement => {
  const skipLink = document.createElement('a');
  skipLink?.href = `#${targetId}`;
  skipLink?.textContent = text;
  skipLink?.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded';
  
  return skipLink;
};

/**
 * Add skip links to page
 */
export const addSkipLinks = (): void => {
  const skipLinks = [
    { targetId: 'main-content', text: 'Skip to main content' },
    { targetId: 'main-navigation', text: 'Skip to navigation' },
    { targetId: 'search', text: 'Skip to search' },
  ];
  
  const skipContainer = document.createElement('div');
  skipContainer?.className = 'skip-links';
  
  skipLinks.forEach(({ targetId, text }) => {
    const target = document.getElementById(targetId as any);
    if (target) {
      const skipLink = createSkipLink(targetId, text);
      skipContainer.appendChild(skipLink as any);
    }
  });
  
  // Insert at the beginning of the body
  document?.body?.insertBefore(skipContainer, document?.body?.firstChild);
};

/**
 * Enhanced focus management for component lifecycle
 */
export class FocusManager {
  private previousActiveElement: Element | null = null;
  private restoreFocus: boolean = true;
  
  constructor(restoreFocus = true) {
    this?.restoreFocus = restoreFocus;
  }
  
  /**
   * Save the currently focused element
   */
  saveFocus(): void {
    this?.previousActiveElement = document.activeElement;
  }
  
  /**
   * Restore focus to the previously focused element
   */
  restoreFocusIfNeeded(): void {
    if (this.restoreFocus && this.previousActiveElement && 'focus' in this.previousActiveElement) {
      (this.previousActiveElement as HTMLElement).focus();
    }
  }
  
  /**
   * Set focus to a specific element
   */
  setFocus(element: HTMLElement): void {
    element.focus();
  }
  
  /**
   * Set focus to the first focusable element in a container
   */
  setFocusToFirst(container: HTMLElement): void {
    const firstFocusable = getFirstFocusableElement(container as any);
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }
}

/**
 * Debounce function for accessibility announcements
 */
export const debounceAnnouncement = (() => {
  let timeoutId: NodeJS.Timeout;
  
  return (text: string, priority: AnnouncementPriority = 'medium', delay = 300) => {
    clearTimeout(timeoutId as any);
    timeoutId = setTimeout(() => {
      announceToScreenReader(text, priority);
    }, delay);
  };
})();

/**
 * Check if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Check if user has a high contrast preference
 */
export const prefersHighContrast = (): boolean => {
  return window.matchMedia('(prefers-contrast: high)').matches;
};

/**
 * ARIA roles for common UI patterns
 */
export const AriaRoles = {
  BUTTON: 'button',
  LINK: 'link',
  MENUITEM: 'menuitem',
  MENUBAR: 'menubar',
  MENU: 'menu',
  TAB: 'tab',
  TABLIST: 'tablist',
  TABPANEL: 'tabpanel',
  GRID: 'grid',
  GRIDCELL: 'gridcell',
  ROW: 'row',
  COLUMNHEADER: 'columnheader',
  ROWHEADER: 'rowheader',
  LISTBOX: 'listbox',
  OPTION: 'option',
  COMBOBOX: 'combobox',
  DIALOG: 'dialog',
  ALERTDIALOG: 'alertdialog',
  ALERT: 'alert',
  STATUS: 'status',
  REGION: 'region',
  BANNER: 'banner',
  NAVIGATION: 'navigation',
  MAIN: 'main',
  COMPLEMENTARY: 'complementary',
  CONTENTINFO: 'contentinfo',
} as const;

/**
 * Common ARIA states and properties
 */
export const AriaStates = {
  EXPANDED: 'aria-expanded',
  SELECTED: 'aria-selected',
  CHECKED: 'aria-checked',
  DISABLED: 'aria-disabled',
  HIDDEN: 'aria-hidden',
  PRESSED: 'aria-pressed',
  CURRENT: 'aria-current',
  LIVE: 'aria-live',
  ATOMIC: 'aria-atomic',
  RELEVANT: 'aria-relevant',
  BUSY: 'aria-busy',
  OWNS: 'aria-owns',
  CONTROLS: 'aria-controls',
  DESCRIBEDBY: 'aria-describedby',
  LABELLEDBY: 'aria-labelledby',
  LABEL: 'aria-label',
  LEVEL: 'aria-level',
  POSINSET: 'aria-posinset',
  SETSIZE: 'aria-setsize',
  ROWINDEX: 'aria-rowindex',
  COLINDEX: 'aria-colindex',
} as const;

export default {
  getFocusableElements,
  getFirstFocusableElement,
  getLastFocusableElement,
  trapFocus,
  generateAriaId,
  createAriaLabel,
  createAriaDescription,
  announceToScreenReader,
  debounceAnnouncement,
  isActionKey,
  isNavigationKey,
  addSkipLinks,
  FocusManager,
  prefersReducedMotion,
  prefersHighContrast,
  KeyboardKeys,
  AriaRoles,
  AriaStates,
};