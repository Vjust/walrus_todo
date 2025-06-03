'use client';

import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { SecurityUtils } from '@/lib/security-utils';
import { 
  validateSafely, 
  type ValidationResult, 
  type ValidationError 
} from '@/lib/validation-schemas';

export interface SecureFormOptions<T> {
  schema: z.ZodSchema<T>;
  sanitize?: boolean;
  csrfProtection?: boolean;
  rateLimit?: {
    maxAttempts: number;
    windowMs: number;
  };
  onSubmit: (data: T) => Promise<void> | void;
  onError?: (errors: ValidationError[]) => void;
}

export interface SecureFormState<T> {
  data: Partial<T>;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
  submitCount: number;
  lastSubmitTime?: number;
}

export interface SecureFormActions<T> {
  setValue: (field: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  setError: (field: keyof T, error: string) => void;
  clearError: (field: keyof T) => void;
  clearErrors: () => void;
  validateField: (field: keyof T) => boolean;
  validateForm: () => boolean;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  reset: () => void;
  sanitizeValue: (value: string) => string;
}

export interface SecureFormReturn<T> extends SecureFormState<T>, SecureFormActions<T> {
  getFieldProps: (field: keyof T) => {
    value: any;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: () => void;
    error?: string;
    'aria-invalid': boolean;
    'aria-describedby'?: string;
  };
  getSubmitProps: () => {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    disabled: boolean;
  };
}

export function useSecureForm<T extends Record<string, any>>(
  options: SecureFormOptions<T>
): SecureFormReturn<T> {
  const { 
    schema, 
    sanitize = true, 
    csrfProtection = false,
    rateLimit,
    onSubmit, 
    onError 
  } = options;

  // Form state
  const [state, setState] = useState<SecureFormState<T>>({
    data: {},
    errors: {},
    isSubmitting: false,
    isDirty: false,
    isValid: false,
    submitCount: 0,
  });

  // CSRF token management
  const [csrfToken] = useState(() => {
    if (csrfProtection) {
      const token = SecurityUtils.CSRFProtection.generateToken();
      SecurityUtils.CSRFProtection.storeToken(token);
      return token;
    }
    return null;
  });

  // Rate limiting state
  const [rateLimitState, setRateLimitState] = useState({
    attempts: 0,
    windowStart: Date.now(),
  });

  // Check if rate limited
  const isRateLimited = useMemo(() => {
    if (!rateLimit) return false;
    
    const now = Date.now();
    const windowExpired = now - rateLimitState.windowStart > rateLimit.windowMs;
    
    if (windowExpired) {
      setRateLimitState({ attempts: 0, windowStart: now });
      return false;
    }
    
    return rateLimitState.attempts >= rateLimit.maxAttempts;
  }, [rateLimit, rateLimitState]);

  // Sanitize value utility
  const sanitizeValue = useCallback((value: string): string => {
    if (!sanitize) return value;
    return SecurityUtils.sanitizeUserInput(value, false);
  }, [sanitize]);

  // Set single field value
  const setValue = useCallback((field: keyof T, value: any) => {
    setState(prev => {
      const sanitizedValue = typeof value === 'string' ? sanitizeValue(value) : value;
      const newData = { ...prev.data, [field]: sanitizedValue };
      
      // Clear field error when value changes
      const newErrors = { ...prev.errors };
      delete newErrors[field as string];
      
      return {
        ...prev,
        data: newData,
        errors: newErrors,
        isDirty: true,
      };
    });
  }, [sanitizeValue]);

  // Set multiple values
  const setValues = useCallback((values: Partial<T>) => {
    setState(prev => {
      const sanitizedValues: Partial<T> = {};
      
      for (const [key, value] of Object.entries(values)) {
        sanitizedValues[key as keyof T] = typeof value === 'string' ? sanitizeValue(value) : value;
      }
      
      return {
        ...prev,
        data: { ...prev.data, ...sanitizedValues },
        isDirty: true,
      };
    });
  }, [sanitizeValue]);

  // Set field error
  const setError = useCallback((field: keyof T, error: string) => {
    setState(prev => ({
      ...prev,
      errors: { ...prev.errors, [field as string]: error },
    }));
  }, []);

  // Clear single field error
  const clearError = useCallback((field: keyof T) => {
    setState(prev => {
      const newErrors = { ...prev.errors };
      delete newErrors[field as string];
      return { ...prev, errors: newErrors };
    });
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setState(prev => ({ ...prev, errors: {} }));
  }, []);

  // Validate single field
  const validateField = useCallback((field: keyof T): boolean => {
    try {
      const fieldSchema = schema.shape[field as string];
      if (!fieldSchema) return true;
      
      const value = state.data[field];
      const result = fieldSchema.safeParse(value);
      
      if (!result.success) {
        const error = result.error.errors[0]?.message || 'Invalid value';
        setError(field, error);
        return false;
      }
      
      clearError(field);
      return true;
    } catch {
      return true; // If we can't validate, assume it's ok
    }
  }, [schema, state.data, setError, clearError]);

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    const result: ValidationResult<T> = validateSafely(schema, state.data);
    
    if (result.success) {
      clearErrors();
      setState(prev => ({ ...prev, isValid: true }));
      return true;
    }
    
    // Set field errors
    const newErrors: Record<string, string> = {};
    result.errors?.forEach(error => {
      newErrors[error.field] = error.message;
    });
    
    setState(prev => ({ 
      ...prev, 
      errors: newErrors, 
      isValid: false 
    }));
    
    if (onError) {
      onError(result.errors || []);
    }
    
    return false;
  }, [schema, state.data, clearErrors, onError]);

  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Check rate limiting
    if (isRateLimited) {
      setError('form' as keyof T, 'Too many attempts. Please wait before trying again.');
      return;
    }
    
    // Validate CSRF token
    if (csrfProtection && csrfToken) {
      if (!SecurityUtils.CSRFProtection.validateToken(csrfToken)) {
        setError('form' as keyof T, 'Security token invalid. Please refresh the page.');
        return;
      }
    }
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    setState(prev => ({ ...prev, isSubmitting: true }));
    
    try {
      // Update rate limiting
      if (rateLimit) {
        setRateLimitState(prev => ({
          ...prev,
          attempts: prev.attempts + 1,
        }));
      }
      
      // Parse and sanitize data one more time
      const result = validateSafely(schema, state.data);
      if (!result.success) {
        throw new Error('Validation failed during submission');
      }
      
      let finalData = result.data;
      
      // Apply additional sanitization to string fields
      if (sanitize) {
        finalData = SecurityUtils.sanitizeFormData(finalData as Record<string, any>) as T;
      }
      
      // Call submit handler
      await onSubmit(finalData);
      
      // Update submission count and time
      setState(prev => ({
        ...prev,
        submitCount: prev.submitCount + 1,
        lastSubmitTime: Date.now(),
        isDirty: false,
      }));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Submission failed';
      setError('form' as keyof T, errorMessage);
      
      if (onError) {
        onError([{
          field: 'form',
          message: errorMessage,
          code: 'submission_error',
        }]);
      }
    } finally {
      setState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [
    isRateLimited, 
    csrfProtection, 
    csrfToken, 
    validateForm, 
    rateLimit, 
    schema, 
    state.data, 
    sanitize, 
    onSubmit, 
    setError, 
    onError
  ]);

  // Reset form
  const reset = useCallback(() => {
    setState({
      data: {},
      errors: {},
      isSubmitting: false,
      isDirty: false,
      isValid: false,
      submitCount: 0,
    });
    
    // Generate new CSRF token
    if (csrfProtection) {
      const newToken = SecurityUtils.CSRFProtection.generateToken();
      SecurityUtils.CSRFProtection.storeToken(newToken);
    }
  }, [csrfProtection]);

  // Get field props for easy binding
  const getFieldProps = useCallback((field: keyof T) => {
    const value = state.data[field] ?? '';
    const error = state.errors[field as string];
    
    return {
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setValue(field, e.target.value);
      },
      onBlur: () => validateField(field),
      error,
      'aria-invalid': !!error,
      'aria-describedby': error ? `${String(field)}-error` : undefined,
    };
  }, [state.data, state.errors, setValue, validateField]);

  // Get submit props
  const getSubmitProps = useCallback(() => ({
    onSubmit: handleSubmit,
    disabled: state.isSubmitting || isRateLimited,
  }), [handleSubmit, state.isSubmitting, isRateLimited]);

  return {
    // State
    ...state,
    
    // Actions
    setValue,
    setValues,
    setError,
    clearError,
    clearErrors,
    validateField,
    validateForm,
    handleSubmit,
    reset,
    sanitizeValue,
    
    // Helper functions
    getFieldProps,
    getSubmitProps,
  };
}