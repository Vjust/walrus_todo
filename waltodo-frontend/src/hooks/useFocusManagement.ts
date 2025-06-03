/**
 * Focus management hook for accessible modal dialogs, dropdowns, and interactive components
 * Provides comprehensive focus trapping, restoration, and management
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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

  const modalRef = useRef<HTMLElement>(null);
  const focusManagerRef = useRef<FocusManager>();
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize focus manager
  useEffect(() => {
    if (!focusManagerRef.current) {
      focusManagerRef.current = new FocusManager(restoreFocus);
    }
  }, [restoreFocus]);

  // Handle modal opening
  useEffect(() => {
    if (isOpen && modalRef.current && focusManagerRef.current) {
      // Save current focus
      focusManagerRef.current.saveFocus();

      if (announceFocusChanges) {
        announceToScreenReader('Dialog opened', 'medium');
      }

      // Set initial focus
      if (autoFocus) {
        setTimeout(() => {
          if (!modalRef.current) return;

          let elementToFocus: HTMLElement | null = null;

          if (initialFocusSelector) {
            elementToFocus = modalRef.current.querySelector(initialFocusSelector);
          }

          if (!elementToFocus) {
            elementToFocus = getFirstFocusableElement(modalRef.current);
          }

          if (elementToFocus) {
            elementToFocus.focus();
          }

          setIsInitialized(true);
        }, 0);
      } else {
        setIsInitialized(true);
      }
    }
  }, [isOpen, autoFocus, initialFocusSelector, announceFocusChanges]);

  // Handle modal closing
  useEffect(() => {
    if (!isOpen && isInitialized && focusManagerRef.current) {
      if (announceFocusChanges) {
        announceToScreenReader('Dialog closed', 'medium');
      }

      // Restore focus
      focusManagerRef.current.restoreFocusIfNeeded();
      setIsInitialized(false);
    }
  }, [isOpen, isInitialized, announceFocusChanges]);

  // Keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen || !modalRef.current) return;

    // Handle escape key
    if (handleEscape && event.key === KeyboardKeys.ESCAPE) {
      event.preventDefault();
      if (onEscape) {
        onEscape();
      }
      return;
    }

    // Handle focus trapping
    if (shouldTrapFocus && event.key === KeyboardKeys.TAB) {
      trapFocus(modalRef.current, event);
    }
  }, [isOpen, shouldTrapFocus, handleEscape, onEscape]);

  // Set up event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Focus management methods
  const focusFirst = useCallback(() => {
    if (modalRef.current) {
      const firstElement = getFirstFocusableElement(modalRef.current);
      if (firstElement) {
        firstElement.focus();
      }
    }
  }, []);

  const focusLast = useCallback(() => {
    if (modalRef.current) {
      const lastElement = getLastFocusableElement(modalRef.current);
      if (lastElement) {
        lastElement.focus();
      }
    }
  }, []);

  const focusElement = useCallback((selector: string) => {
    if (modalRef.current) {
      const element = modalRef.current.querySelector(selector) as HTMLElement;
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

  const dropdownRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const focusManagerRef = useRef<FocusManager>();
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [menuItems, setMenuItems] = useState<HTMLElement[]>([]);

  // Initialize focus manager
  useEffect(() => {
    if (!focusManagerRef.current) {
      focusManagerRef.current = new FocusManager(restoreFocus);
    }
  }, [restoreFocus]);

  // Update menu items when dropdown opens
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const items = getFocusableElements(dropdownRef.current);
      setMenuItems(items);
      
      if (autoFocus && items.length > 0) {
        setCurrentIndex(0);
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
  const focusNext = useCallback(() => {
    if (menuItems.length === 0) return;
    
    const nextIndex = currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(nextIndex);
    menuItems[nextIndex].focus();
    
    if (announceFocusChanges) {
      announceToScreenReader(`Item ${nextIndex + 1} of ${menuItems.length}`, 'low');
    }
  }, [currentIndex, menuItems, announceFocusChanges]);

  const focusPrevious = useCallback(() => {
    if (menuItems.length === 0) return;
    
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
    setCurrentIndex(prevIndex);
    menuItems[prevIndex].focus();
    
    if (announceFocusChanges) {
      announceToScreenReader(`Item ${prevIndex + 1} of ${menuItems.length}`, 'low');
    }
  }, [currentIndex, menuItems, announceFocusChanges]);

  const focusFirst = useCallback(() => {
    if (menuItems.length > 0) {
      setCurrentIndex(0);
      menuItems[0].focus();
    }
  }, [menuItems]);

  const focusLast = useCallback(() => {
    if (menuItems.length > 0) {
      const lastIndex = menuItems.length - 1;
      setCurrentIndex(lastIndex);
      menuItems[lastIndex].focus();
    }
  }, [menuItems]);

  // Keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case KeyboardKeys.ESCAPE:
        if (handleEscape) {
          event.preventDefault();
          if (onEscape) {
            onEscape();
          } else if (triggerRef.current) {
            triggerRef.current.focus();
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
  useEffect(() => {
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

  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Focus first error field
  const focusFirstError = useCallback(() => {
    if (!formRef.current) return;

    const errorFields = Object.keys(errors);
    if (errorFields.length === 0) return;

    for (const fieldName of errorFields) {
      const field = formRef.current.querySelector(`[name="${fieldName}"]`) as HTMLElement;
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
  const focusFirstField = useCallback(() => {
    if (!formRef.current) return;

    let elementToFocus: HTMLElement | null = null;

    if (initialFocusSelector) {
      elementToFocus = formRef.current.querySelector(initialFocusSelector);
    }

    if (!elementToFocus) {
      elementToFocus = getFirstFocusableElement(formRef.current);
    }

    if (elementToFocus) {
      elementToFocus.focus();
    }
  }, [initialFocusSelector]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus) {
      setTimeout(focusFirstField, 0);
    }
  }, [autoFocus, focusFirstField]);

  // Focus first error when errors change
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
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
export const useFocusAnnouncements = (enabled = true) => {
  const lastAnnouncementRef = useRef<string>('');
  const announcementTimeoutRef = useRef<NodeJS.Timeout>();

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
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role') || tagName;
    const label = element.getAttribute('aria-label') || 
                  element.getAttribute('aria-labelledby') ||
                  (element as any).innerText?.trim() ||
                  element.getAttribute('title') ||
                  element.getAttribute('alt') ||
                  '';

    // Build announcement
    const parts = [role];
    if (label) parts.push(label);
    if (context) parts.push(context);

    const announcement = parts.join(', ');

    // Avoid duplicate announcements
    if (announcement === lastAnnouncementRef.current) return;

    lastAnnouncementRef.current = announcement;

    // Announce after a short delay to ensure focus has moved
    announcementTimeoutRef.current = setTimeout(() => {
      announceToScreenReader(announcement, priority);
    }, 100);
  }, [enabled]);

  // Clean up timeout on unmount
  useEffect(() => {
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