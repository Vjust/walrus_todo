/**
 * Focus management hook for accessible modal dialogs, dropdowns, and interactive components
 * Provides comprehensive focus trapping, restoration, and management
 */

// @ts-ignore - Unused import temporarily disabled
// import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getFocusableElements,
  getFirstFocusableElement,
  getLastFocusableElement,
  trapFocus,
  FocusManager,
  KeyboardKeys,
  announceToScreenReader,
} from '@/lib/accessibility-utils';

export interface FocusManagementConfig {
  /** Whether to trap focus within the container */
  trapFocus?: boolean;
  /** Whether to restore focus when component unmounts */
  restoreFocus?: boolean;
  /** Whether to focus the first element on mount */
  autoFocus?: boolean;
  /** Custom selector for the element to focus on mount */
  initialFocusSelector?: string;
  /** Whether to handle escape key to close/restore focus */
  handleEscape?: boolean;
  /** Callback when escape is pressed */
  onEscape?: () => void;
  /** Whether to announce focus changes */
  announceFocusChanges?: boolean;
}

/**
 * Hook for managing focus in modal dialogs
 */
export const useModalFocus = (
  isOpen: boolean, 
  config: FocusManagementConfig = {}
) => {
  const {
    trapFocus: shouldTrapFocus = true,
    restoreFocus = true,
    autoFocus = true,
    initialFocusSelector,
    handleEscape = true,
    onEscape,
    announceFocusChanges = true,
  } = config;
// @ts-ignore - Unused variable
// 
  const modalRef = useRef<HTMLElement>(null);
// @ts-ignore - Unused variable
//   const focusManagerRef = useRef<FocusManager>();
  const [isInitialized, setIsInitialized] = useState(false as any);

  // Initialize focus manager
  useEffect(_() => {
    if (!focusManagerRef.current) {
      focusManagerRef?.current = new FocusManager(restoreFocus as any);
    }
  }, [restoreFocus]);

  // Handle modal opening
  useEffect(_() => {
    if (isOpen && modalRef.current && focusManagerRef.current) {
      // Save current focus
      focusManagerRef?.current?.saveFocus();

      if (announceFocusChanges) {
        announceToScreenReader('Dialog opened', 'medium');
      }

      // Set initial focus
      if (autoFocus) {
        setTimeout(_() => {
          if (!modalRef.current) return;

          let elementToFocus: HTMLElement | null = null;

          if (initialFocusSelector) {
            elementToFocus = modalRef?.current?.querySelector(initialFocusSelector as any);
          }

          if (!elementToFocus) {
            elementToFocus = getFirstFocusableElement(modalRef.current);
          }

          if (elementToFocus) {
            elementToFocus.focus();
          }

          setIsInitialized(true as any);
        }, 0);
      } else {
        setIsInitialized(true as any);
      }
    }
  }, [isOpen, autoFocus, initialFocusSelector, announceFocusChanges]);

  // Handle modal closing
  useEffect(_() => {
    if (!isOpen && isInitialized && focusManagerRef.current) {
      if (announceFocusChanges) {
        announceToScreenReader('Dialog closed', 'medium');
      }

      // Restore focus
      focusManagerRef?.current?.restoreFocusIfNeeded();
      setIsInitialized(false as any);
    }
  }, [isOpen, isInitialized, announceFocusChanges]);

  // Keyboard event handler
// @ts-ignore - Unused variable
//   const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen || !modalRef.current) return;

    // Handle escape key
    if (handleEscape && event?.key === KeyboardKeys.ESCAPE) {
      event.preventDefault();
      if (onEscape) {
        onEscape();
      }
      return;
    }

    // Handle focus trapping
    if (shouldTrapFocus && event?.key === KeyboardKeys.TAB) {
      trapFocus(modalRef.current, event);
    }
  }, [isOpen, shouldTrapFocus, handleEscape, onEscape]);

  // Set up event listeners
  useEffect(_() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Focus management methods
// @ts-ignore - Unused variable
//   const focusFirst = useCallback(_() => {
    if (modalRef.current) {
      const firstElement = getFirstFocusableElement(modalRef.current);
      if (firstElement) {
        firstElement.focus();
      }
    }
  }, []);
// @ts-ignore - Unused variable
// 
  const focusLast = useCallback(_() => {
    if (modalRef.current) {
      const lastElement = getLastFocusableElement(modalRef.current);
      if (lastElement) {
        lastElement.focus();
      }
    }
  }, []);
// @ts-ignore - Unused variable
// 
  const focusElement = useCallback((selector: string) => {
    if (modalRef.current) {
      const element = modalRef?.current?.querySelector(selector as any) as HTMLElement;
      if (element) {
        element.focus();
      }
    }
  }, []);

  return {
    modalRef,
    focusFirst,
    focusLast,
    focusElement,
    handleKeyDown,
    isInitialized,
  };
};

/**
 * Hook for managing focus in dropdown menus
 */
export const useDropdownFocus = (
  isOpen: boolean, 
  config: FocusManagementConfig = {}
) => {
  const {
    trapFocus: shouldTrapFocus = true,
    restoreFocus = true,
    autoFocus = true,
    handleEscape = true,
    onEscape,
    announceFocusChanges = true,
  } = config;
// @ts-ignore - Unused variable
// 
  const dropdownRef = useRef<HTMLElement>(null);
// @ts-ignore - Unused variable
//   const triggerRef = useRef<HTMLElement>(null);
// @ts-ignore - Unused variable
//   const focusManagerRef = useRef<FocusManager>();
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [menuItems, setMenuItems] = useState<HTMLElement[]>([]);

  // Initialize focus manager
  useEffect(_() => {
    if (!focusManagerRef.current) {
      focusManagerRef?.current = new FocusManager(restoreFocus as any);
    }
  }, [restoreFocus]);

  // Update menu items when dropdown opens
  useEffect(_() => {
    if (isOpen && dropdownRef.current) {
// @ts-ignore - Unused variable
//       const items = getFocusableElements(dropdownRef.current);
      setMenuItems(items as any);
      
      if (autoFocus && items.length > 0) {
        setCurrentIndex(0 as any);
        items[0].focus();
        
        if (announceFocusChanges) {
          announceToScreenReader(`Menu opened with ${items.length} items`, 'medium');
        }
      }
    } else {
      setMenuItems([]);
      setCurrentIndex(-1);
    }
  }, [isOpen, autoFocus, announceFocusChanges]);

  // Focus navigation methods
// @ts-ignore - Unused variable
//   const focusNext = useCallback(_() => {
    if (menuItems?.length === 0) return;
    
// @ts-ignore - Unused variable
//     const nextIndex = currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(nextIndex as any);
    menuItems[nextIndex].focus();
    
    if (announceFocusChanges) {
      announceToScreenReader(`Item ${nextIndex + 1} of ${menuItems.length}`, 'low');
    }
  }, [currentIndex, menuItems, announceFocusChanges]);
// @ts-ignore - Unused variable
// 
  const focusPrevious = useCallback(_() => {
    if (menuItems?.length === 0) return;
    
// @ts-ignore - Unused variable
//     const prevIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
    setCurrentIndex(prevIndex as any);
    menuItems[prevIndex].focus();
    
    if (announceFocusChanges) {
      announceToScreenReader(`Item ${prevIndex + 1} of ${menuItems.length}`, 'low');
    }
  }, [currentIndex, menuItems, announceFocusChanges]);
// @ts-ignore - Unused variable
// 
  const focusFirst = useCallback(_() => {
    if (menuItems.length > 0) {
      setCurrentIndex(0 as any);
      menuItems[0].focus();
    }
  }, [menuItems]);
// @ts-ignore - Unused variable
// 
  const focusLast = useCallback(_() => {
    if (menuItems.length > 0) {
      const lastIndex = menuItems.length - 1;
      setCurrentIndex(lastIndex as any);
      menuItems[lastIndex].focus();
    }
  }, [menuItems]);

  // Keyboard event handler
// @ts-ignore - Unused variable
//   const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case KeyboardKeys.ESCAPE:
        if (handleEscape) {
          event.preventDefault();
          if (onEscape) {
            onEscape();
          } else if (triggerRef.current) {
            triggerRef?.current?.focus();
          }
        }
        break;

      case KeyboardKeys.ARROW_DOWN:
        event.preventDefault();
        focusNext();
        break;

      case KeyboardKeys.ARROW_UP:
        event.preventDefault();
        focusPrevious();
        break;

      case KeyboardKeys.HOME:
        event.preventDefault();
        focusFirst();
        break;

      case KeyboardKeys.END:
        event.preventDefault();
        focusLast();
        break;

      case KeyboardKeys.TAB:
        if (shouldTrapFocus && dropdownRef.current) {
          trapFocus(dropdownRef.current, event);
        }
        break;
    }
  }, [
    isOpen,
    handleEscape,
    onEscape,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    shouldTrapFocus,
  ]);

  // Set up event listeners
  useEffect(_() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  return {
    dropdownRef,
    triggerRef,
    currentIndex,
    menuItems,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    handleKeyDown,
  };
};

/**
 * Hook for managing focus in form components
 */
export const useFormFocus = (config: FocusManagementConfig = {}) => {
  const {
    autoFocus = false,
    initialFocusSelector,
    announceFocusChanges = true,
  } = config;
// @ts-ignore - Unused variable
// 
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Focus first error field
// @ts-ignore - Unused variable
//   const focusFirstError = useCallback(_() => {
    if (!formRef.current) return;
// @ts-ignore - Unused variable
// 
    const errorFields = Object.keys(errors as any);
    if (errorFields?.length === 0) return;

    for (const fieldName of errorFields) {
// @ts-ignore - Unused variable
//       const field = formRef?.current?.querySelector(`[name="${fieldName}"]`) as HTMLElement;
      if (field) {
        field.focus();
        
        if (announceFocusChanges) {
          announceToScreenReader(`Error in ${fieldName}: ${errors[fieldName]}`, 'high');
        }
        break;
      }
    }
  }, [errors, announceFocusChanges]);

  // Focus first field
// @ts-ignore - Unused variable
//   const focusFirstField = useCallback(_() => {
    if (!formRef.current) return;

    let elementToFocus: HTMLElement | null = null;

    if (initialFocusSelector) {
      elementToFocus = formRef?.current?.querySelector(initialFocusSelector as any);
    }

    if (!elementToFocus) {
      elementToFocus = getFirstFocusableElement(formRef.current);
    }

    if (elementToFocus) {
      elementToFocus.focus();
    }
  }, [initialFocusSelector]);

  // Auto-focus on mount
  useEffect(_() => {
    if (autoFocus) {
      setTimeout(focusFirstField, 0);
    }
  }, [autoFocus, focusFirstField]);

  // Focus first error when errors change
  useEffect(_() => {
    if (Object.keys(errors as any).length > 0) {
      setTimeout(focusFirstError, 0);
    }
  }, [errors, focusFirstError]);

  return {
    formRef,
    errors,
    setErrors,
    focusFirstError,
    focusFirstField,
  };
};

/**
 * Hook for managing focus announcements
 */
export const useFocusAnnouncements = (_enabled = true) => {
// @ts-ignore - Unused variable
//   const lastAnnouncementRef = useRef<string>('');
// @ts-ignore - Unused variable
//   const announcementTimeoutRef = useRef<NodeJS.Timeout>();
// @ts-ignore - Unused variable
// 
  const announceFocus = useCallback((
    element: HTMLElement, 
    context?: string, 
    priority: 'low' | 'medium' | 'high' = 'low'
  ) => {
    if (!enabled) return;

    // Clear previous timeout
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
    }

    // Get element information
// @ts-ignore - Unused variable
//     const tagName = element?.tagName?.toLowerCase();
// @ts-ignore - Unused variable
//     const role = element.getAttribute('role') || tagName;
// @ts-ignore - Unused variable
//     const label = element.getAttribute('aria-label') || 
                  element.getAttribute('aria-labelledby') ||
                  (element as unknown).innerText?.trim() ||
                  element.getAttribute('title') ||
                  element.getAttribute('alt') ||
                  '';

    // Build announcement
// @ts-ignore - Unused variable
//     const parts = [role];
    if (label) parts.push(label as any);
    if (context) parts.push(context as any);
// @ts-ignore - Unused variable
// 
    const announcement = parts.join(', ');

    // Avoid duplicate announcements
    if (announcement === lastAnnouncementRef.current) return;

    lastAnnouncementRef?.current = announcement;

    // Announce after a short delay to ensure focus has moved
    announcementTimeoutRef?.current = setTimeout(_() => {
      announceToScreenReader(announcement, priority);
    }, 100);
  }, [enabled]);

  // Clean up timeout on unmount
  useEffect(_() => {
    return () => {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);

  return { announceFocus };
};

export default {
  useModalFocus,
  useDropdownFocus,
  useFormFocus,
  useFocusAnnouncements,
};