'use client';

import React, { useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useWalletContext } from '@/contexts/WalletContext';
import { useSuiClient } from '@/hooks/useSuiClient';
import { storeTodoOnBlockchain } from '@/lib/sui-client';
import { addTodo } from '@/lib/todo-service';
import toast from 'react-hot-toast';
import type { CreateTodoParams, Todo } from '@/types/todo-nft';
import { 
  type TodoTemplate,
  useCreateTodoNFTAdvancedOptions,
  useCreateTodoNFTFormData,
  useCreateTodoNFTImageState,
  useCreateTodoNFTLoadingState,
  useCreateTodoNFTStore
} from '@/stores/createTodoNFTStore';
import { useSecureForm } from '@/hooks/useSecureForm';
import { createTodoNFTSchema, RATE_LIMIT_CONFIGS } from '@/lib/validation-schemas';
import { SecurityUtils } from '@/lib/security-utils';
import { useRateLimit } from '@/lib/rate-limiter';
import { useFormFocus } from '@/hooks/useFocusManagement';
import { useAnnouncementShortcuts, AccessibilityAnnouncerProvider } from './AccessibilityAnnouncer';
import { useStatusAnnouncements } from '@/hooks/useAriaLive';
import { 
  generateAriaId, 
  createAriaLabel, 
  createAriaDescription,
  AriaRoles, 
  AriaStates,
  KeyboardKeys,
  isActionKey
} from '@/lib/accessibility-utils';

const templates: TodoTemplate[] = [
  {
    id: 'meeting',
    name: 'Meeting Notes',
    title: 'Team Meeting - ',
    description: 'Discussion points:\n- \n- \nAction items:\n- ',
    priority: 'medium',
    tags: ['meeting', 'work'],
    category: 'work',
    icon: '👥',
  },
  {
    id: 'task',
    name: 'Task',
    title: '',
    description: 'Objective:\n\nSteps:\n1. \n2. \n\nDeadline: ',
    priority: 'high',
    tags: ['task', 'work'],
    category: 'work',
    icon: '✅',
  },
  {
    id: 'idea',
    name: 'Idea',
    title: 'Idea: ',
    description: 'Concept:\n\nPotential benefits:\n- \n\nNext steps:\n- ',
    priority: 'low',
    tags: ['idea', 'creative'],
    category: 'personal',
    icon: '💡',
  },
  {
    id: 'shopping',
    name: 'Shopping List',
    title: 'Shopping - ',
    description: 'Items to buy:\n- \n- \n- ',
    priority: 'medium',
    tags: ['shopping', 'personal'],
    category: 'personal',
    icon: '🛒',
  },
];

interface CreateTodoNFTFormProps {
  listName?: string;
  onTodoCreated?: (todo: Todo) => void;
  onCancel?: () => void;
  /** ARIA label for the form */
  ariaLabel?: string;
  /** ARIA described by IDs */
  ariaDescribedBy?: string;
  /** Whether to auto-focus the first input */
  autoFocus?: boolean;
}

export default function CreateTodoNFTForm({
  listName = 'default',
  onTodoCreated,
  onCancel,
  ariaLabel = 'Create Todo NFT form',
  ariaDescribedBy,
  autoFocus = true,
}: CreateTodoNFTFormProps) {
  // Zustand store hooks
  const { title, description, priority, tags, dueDate, category } = useCreateTodoNFTFormData();
  const { imageFile, imagePreview, isCompressing } = useCreateTodoNFTImageState();
  const { isSubmitting, uploadProgress, uploadStage, error } = useCreateTodoNFTLoadingState();
  const { showAdvanced, isPrivate, expirationDays } = useCreateTodoNFTAdvancedOptions();
  
  // Store actions
  const {
    setTitle, setDescription, setPriority, setTags, setDueDate, setCategory,
    setImageFile, setImagePreview, setIsCompressing,
    setShowAdvanced, setIsPrivate, setExpirationDays,
    setIsSubmitting, setUploadProgress, setUploadStage, setError,
    setEstimatedCost, setSelectedTemplate, applyTemplate, resetForm,
    selectedTemplate, estimatedCost
  } = useCreateTodoNFTStore();
  
  // Refs for accessibility
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Generate unique IDs for accessibility
  const formId = useMemo(() => generateAriaId('create-todo-nft-form'), []);
  const titleId = useMemo(() => generateAriaId('todo-title'), []);
  const descriptionId = useMemo(() => generateAriaId('todo-description'), []);
  const templateSectionId = useMemo(() => generateAriaId('template-section'), []);
  const imageUploadId = useMemo(() => generateAriaId('image-upload'), []);
  const advancedOptionsId = useMemo(() => generateAriaId('advanced-options'), []);
  const costEstimateId = useMemo(() => generateAriaId('cost-estimate'), []);
  const progressId = useMemo(() => generateAriaId('upload-progress'), []);
  const errorId = useMemo(() => generateAriaId('form-error'), []);
  
  // Hooks
  const walletContext = useWalletContext();
  const { address, connected, signAndExecuteTransaction } = walletContext || {};
  const { isInitialized: suiClientInitialized } = useSuiClient('testnet');
  
  // Accessibility hooks
  const { announceSuccess, announceError, announceLoading, announceInfo } = useAnnouncementShortcuts();
  const { announceStatus, announceProgress, StatusRegion } = useStatusAnnouncements();
  
  // Form focus management
  const { 
    focusableElements, 
    currentFocusIndex, 
    trapFocus, 
    restoreFocus,
    focusFirst,
    focusLast 
  } = useFormFocus(formRef, {
    autoFocus: autoFocus && connected,
    restoreOnUnmount: true,
    trapFocus: true
  });
  
  // Calculate estimated size
  const estimatedSize = useMemo(() => {
    let size = 0;
    size += new Blob([title]).size;
    size += new Blob([description]).size;
    size += new Blob([tags]).size;
    size += new Blob([JSON.stringify({ priority, category, dueDate })]).size;
    if (imageFile) {
      size += imageFile.size;
    }
    return size;
  }, [title, description, tags, priority, category, dueDate, imageFile]);
  
  // Update storage cost estimate when content changes
  const updateCostEstimate = useCallback(async () => {
    if (!connected || !address) {return;}
    
    try {
      // Simple cost estimation based on data size
      const totalCostInWAL = (estimatedSize / 1024) * 0.001; // Rough estimate: 0.001 WAL per KB
      setEstimatedCost({
        totalCost: totalCostInWAL.toFixed(6),
        breakdown: {
          storage: (totalCostInWAL * 0.8).toFixed(6), // Approximate storage portion
          transaction: (totalCostInWAL * 0.2).toFixed(6), // Approximate transaction fees
        },
      });
    } catch (err) {
      console.error('Failed to estimate costs:', err);
    }
  }, [connected, address, estimatedSize]);
  
  // Debounced cost estimate update
  React.useEffect(() => {
    const timer = setTimeout(updateCostEstimate, 500);
    return () => clearTimeout(timer);
  }, [updateCostEstimate]);
  
  // Handle template selection with accessibility
  const handleTemplateSelect = useCallback((templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setTitle(template.title);
      setDescription(template.description);
      setPriority(template.priority);
      setTags(template.tags.join(', '));
      setCategory(template.category);
      setSelectedTemplate(templateId);
      
      // Announce template selection
      announceInfo(`Applied ${template.name} template to form`);
      
      // Focus on title field if empty or auto-generated
      if (titleInputRef.current && (!template.title || template.title.endsWith(' - '))) {
        setTimeout(() => {
          titleInputRef.current?.focus();
          titleInputRef.current?.setSelectionRange(titleInputRef.current.value.length, titleInputRef.current.value.length);
        }, 100);
      }
    }
  }, [announceInfo, setTitle, setDescription, setPriority, setTags, setCategory, setSelectedTemplate]);
  
  // Handle image selection with security validation and accessibility
  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {return;}
    
    announceLoading('Validating image file...');
    
    // Validate file using security utilities
    const validation = SecurityUtils.InputValidator.validateFile(file);
    if (!validation.isValid) {
      const errorMessage = validation.errors.join(', ');
      setError(errorMessage);
      announceError(`Image validation failed: ${errorMessage}`);
      return;
    }
    
    setError(null);
    setIsCompressing(true);
    announceLoading('Processing image...');
    
    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
        announceInfo('Image preview loaded successfully');
      };
      reader.readAsDataURL(file);
      
      // Compress image if needed
      const compressedFile = await compressImage(file);
      setImageFile(compressedFile);
      
      const sizeKB = (compressedFile.size / 1024).toFixed(1);
      announceSuccess(`Image processed successfully. Size: ${sizeKB}KB`);
    } catch (err) {
      const errorMessage = 'Failed to process image';
      setError(errorMessage);
      announceError(errorMessage);
      console.error('Image processing error:', err);
    } finally {
      setIsCompressing(false);
    }
  }, [announceLoading, announceError, announceInfo, announceSuccess, setError, setIsCompressing, setImagePreview, setImageFile]);
  
  // Image compression function
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new globalThis.Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      img.onload = () => {
        // Calculate new dimensions (max 1024px on longest side)
        let { width, height } = img;
        const maxSize = 1024;
        
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Compression failed'));
            }
          },
          'image/jpeg',
          0.85 // 85% quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };
  
  // Rate limiting for NFT creation
  const { checkLimit: checkNFTRateLimit } = useRateLimit('nft_creation', RATE_LIMIT_CONFIGS.FILE_UPLOAD);
  
  // Secure form validation
  const secureForm = useSecureForm({
    schema: createTodoNFTSchema,
    sanitize: true,
    csrfProtection: true,
    rateLimit: {
      maxAttempts: 3,
      windowMs: 60 * 1000, // 1 minute
    },
    onSubmit: async (validatedData) => {
      // This will be called with validated and sanitized data
      await handleSecureSubmit(validatedData);
    },
    onError: (errors) => {
      const errorMessage = errors.map(err => err.message).join(', ');
      setError(errorMessage);
      toast.error(errorMessage, { duration: 5000 });
    },
  });

  // Handle secure form submission with accessibility
  const handleSecureSubmit = useCallback(async (validatedData: typeof createTodoNFTSchema._type) => {
    if (!connected || !address || !signAndExecuteTransaction) {
      const errorMessage = 'Please connect your wallet to create Todo NFTs';
      announceError(errorMessage);
      throw new Error(errorMessage);
    }
    
    // Check rate limiting
    const rateLimitResult = checkNFTRateLimit();
    if (!rateLimitResult.allowed) {
      const waitTime = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      const errorMessage = `Rate limit exceeded. Please wait ${waitTime} seconds.`;
      announceError(errorMessage);
      throw new Error(errorMessage);
    }
    
    setIsSubmitting(true);
    setError(null);
    setUploadProgress(0);
    announceLoading('Starting Todo NFT creation...');
    
    try {
      // Sanitize and prepare todo data
      const todoData = {
        title: SecurityUtils.sanitizeUserInput(validatedData.title),
        description: validatedData.description ? SecurityUtils.sanitizeUserInput(validatedData.description) : '',
        completed: false,
        priority: validatedData.priority,
        tags: validatedData.tags || [],
        dueDate: validatedData.dueDate || undefined,
        category: validatedData.category,
        isPrivate: validatedData.isPrivate || false,
      };
      
      // First create local todo
      setUploadStage('Creating todo...');
      setUploadProgress(30);
      announceProgress('Creating local todo entry...', 30);
      
      const localTodo = addTodo(listName, todoData, address || undefined);
      
      // Try to create on blockchain
      setUploadStage('Creating NFT on blockchain...');
      setUploadProgress(60);
      announceProgress('Creating NFT on blockchain...', 60);
      
      const blockchainResult = await storeTodoOnBlockchain(
        {
          ...todoData,
          imageUrl: imagePreview || '',
          metadata: JSON.stringify({ category, expirationDays }),
        },
        signAndExecuteTransaction!,
        address!
      );
      
      if (!blockchainResult.success || !blockchainResult.objectId) {
        const errorMessage = blockchainResult.error || 'Failed to create NFT on blockchain';
        announceError(errorMessage);
        throw new Error(errorMessage);
      }
      
      const objectId = blockchainResult.objectId;
      
      setUploadProgress(100);
      setUploadStage('Todo NFT created successfully!');
      announceProgress('Todo NFT created successfully!', 100);
      
      // Success notification
      const successMessage = 'Todo NFT created successfully! 🎉';
      toast.success(successMessage, { duration: 5000 });
      announceSuccess(`${todoData.title} created as NFT successfully`);
      
      // Call success callback
      const createdTodo: Todo = {
        id: localTodo.id,
        ...todoData,
        blockchainStored: true,
        objectId,
        createdAt: localTodo.createdAt,
        updatedAt: localTodo.updatedAt,
      };
      
      if (onTodoCreated) {
        onTodoCreated(createdTodo);
      }
      
      // Reset form
      handleResetForm();
      
    } catch (err) {
      console.error('Failed to create Todo NFT:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create Todo NFT';
      setError(errorMessage);
      toast.error(errorMessage, { duration: 5000 });
      announceError(`NFT creation failed: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
      setUploadStage('');
    }
  }, [
    connected, address, signAndExecuteTransaction, checkNFTRateLimit, announceError, announceLoading, 
    announceProgress, announceSuccess, setIsSubmitting, setError, setUploadProgress, setUploadStage,
    listName, imagePreview, category, expirationDays, onTodoCreated
  ]);
  
  // Reset form with accessibility
  const handleResetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setTags('');
    setDueDate('');
    setCategory('personal');
    setImageFile(null);
    setImagePreview(null);
    setIsPrivate(false);
    setExpirationDays(365);
    setSelectedTemplate(null);
    setUploadProgress(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    announceInfo('Form has been reset to default values');
    
    // Focus on title field after reset
    if (autoFocus && titleInputRef.current) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [
    setTitle, setDescription, setPriority, setTags, setDueDate, setCategory,
    setImageFile, setImagePreview, setIsPrivate, setExpirationDays, setSelectedTemplate,
    setUploadProgress, setError, announceInfo, autoFocus
  ]);

  // Keyboard navigation handler
  const handleFormKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle Escape key
    if (e.key === KeyboardKeys.ESCAPE) {
      if (onCancel) {
        e.preventDefault();
        onCancel();
        announceInfo('Form cancelled');
      }
    }
    
    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          if (formRef.current) {
            const submitButton = formRef.current.querySelector('button[type="submit"]') as HTMLButtonElement;
            if (submitButton && !submitButton.disabled) {
              submitButton.click();
            }
          }
          break;
        case 'r':
          e.preventDefault();
          handleResetForm();
          break;
      }
    }
  }, [onCancel, announceInfo, handleResetForm]);
  
  return (
    <AccessibilityAnnouncerProvider>
      <div className="max-w-4xl mx-auto">
        {/* Screen reader instructions */}
        <div className="sr-only">
          <h1 id={`${formId}-instructions`}>Create Todo NFT Form</h1>
          <p>
            Use this form to create a new Todo as an NFT on the Sui blockchain. 
            Fill in the required fields marked with asterisks (*). 
            Use Tab to navigate between fields, and Escape to cancel.
            Keyboard shortcuts: Ctrl+Enter to submit, Ctrl+R to reset.
          </p>
        </div>

        <form 
          ref={formRef}
          onSubmit={secureForm.handleSubmit} 
          onKeyDown={handleFormKeyDown}
          className="space-y-6"
          role="form"
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy || `${formId}-instructions`}
          aria-labelledby={`${formId}-title`}
          noValidate
          id={formId}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 
              id={`${formId}-title`}
              className="text-2xl font-bold text-ocean-deep dark:text-ocean-light"
            >
              Create Todo NFT
            </h2>
            {onCancel && (
              <button
                type="button"
                onClick={() => {
                  onCancel();
                  announceInfo('Form cancelled');
                }}
                onKeyDown={(e) => {
                  if (isActionKey(e.key)) {
                    e.preventDefault();
                    onCancel();
                    announceInfo('Form cancelled');
                  }
                }}
                className="text-ocean-medium hover:text-ocean-deep transition-colors focus:outline-none focus:ring-2 focus:ring-ocean-medium rounded-md px-2 py-1"
                aria-label="Cancel form and return to previous page"
              >
                Cancel
              </button>
            )}
          </div>
        
          {/* Error display with accessibility */}
          {error && (
            <div 
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
              role="alert"
              aria-live="assertive"
              id={errorId}
            >
              <div className="flex items-start">
                <svg 
                  className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                    Form Error
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}
        
          {/* Templates with accessibility */}
          <fieldset className="space-y-3" id={templateSectionId}>
            <legend className="block text-sm font-medium text-ocean-medium dark:text-ocean-light">
              Start with a template (optional)
            </legend>
            <div className="sr-only">
              <p id={`${templateSectionId}-desc`}>
                Choose from predefined templates to quickly populate form fields. Each template includes a title, description, and appropriate tags.
              </p>
            </div>
            <div 
              className="grid grid-cols-2 md:grid-cols-4 gap-3"
              role="radiogroup"
              aria-labelledby={templateSectionId}
              aria-describedby={`${templateSectionId}-desc`}
            >
              {templates.map((template, index) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template.id)}
                  onKeyDown={(e) => {
                    if (isActionKey(e.key)) {
                      e.preventDefault();
                      handleTemplateSelect(template.id);
                    }
                  }}
                  className={`p-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-ocean-medium ${
                    selectedTemplate === template.id
                      ? 'border-ocean-deep bg-ocean-light/10 dark:border-ocean-light dark:bg-ocean-deep/10 ring-2 ring-ocean-medium'
                      : 'border-gray-200 dark:border-gray-700 hover:border-ocean-medium'
                  }`}
                  role="radio"
                  aria-checked={selectedTemplate === template.id}
                  aria-label={`${template.name} template. ${template.icon}. Creates a ${template.category} todo with ${template.priority} priority.`}
                  aria-describedby={`template-${template.id}-desc`}
                  tabIndex={selectedTemplate === template.id ? 0 : -1}
                >
                  <div className="text-2xl mb-1" aria-hidden="true">{template.icon}</div>
                  <div className="text-sm font-medium">{template.name}</div>
                  <div id={`template-${template.id}-desc`} className="sr-only">
                    Template includes: {template.title || 'Custom title'}, {template.description ? 'predefined description' : 'no description'}, {template.priority} priority, {template.tags.join(', ')} tags
                  </div>
                </button>
              ))}
            </div>
          </fieldset>
        
          {/* Image Upload with accessibility */}
          <fieldset className="space-y-3" id={imageUploadId}>
            <legend className="block text-sm font-medium text-ocean-medium dark:text-ocean-light">
              NFT Image (Optional)
            </legend>
            <div className="sr-only">
              <p id={`${imageUploadId}-desc`}>
                Upload an image file to represent your Todo NFT. Supported formats: PNG, JPG, GIF, WebP. Maximum size: 10MB. Images will be automatically compressed.
              </p>
            </div>
            <div className="flex items-start space-x-4" role="group" aria-describedby={`${imageUploadId}-desc`}>
              {/* Image Preview */}
              <div className="flex-shrink-0">
                {imagePreview ? (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-ocean-light">
                    <Image
                      src={imagePreview}
                      alt="NFT image preview"
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                      priority
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                        announceInfo('Image removed from form');
                      }}
                      onKeyDown={(e) => {
                        if (isActionKey(e.key)) {
                          e.preventDefault();
                          setImageFile(null);
                          setImagePreview(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                          announceInfo('Image removed from form');
                        }
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label="Remove selected image"
                      title="Remove image"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                ) : (
                  <div 
                    className="w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center"
                    aria-label="No image selected"
                  >
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
              </div>
              
              {/* Upload Button */}
              <div className="flex-1 space-y-2">
                <label htmlFor={`${imageUploadId}-input`} className="sr-only">
                  Select image file for NFT
                </label>
                <input
                  id={`${imageUploadId}-input`}
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                  aria-describedby={`${imageUploadId}-help ${imageUploadId}-size`}
                />
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                    announceInfo('Opening file picker for image selection');
                  }}
                  onKeyDown={(e) => {
                    if (isActionKey(e.key)) {
                      e.preventDefault();
                      fileInputRef.current?.click();
                      announceInfo('Opening file picker for image selection');
                    }
                  }}
                  disabled={isCompressing}
                  className="ocean-button-secondary focus:ring-2 focus:ring-ocean-medium disabled:opacity-50"
                  aria-label={isCompressing ? 'Processing image, please wait' : 'Choose image file for NFT'}
                  aria-describedby={`${imageUploadId}-help`}
                >
                  {isCompressing ? 'Processing...' : 'Choose Image'}
                </button>
                <p id={`${imageUploadId}-help`} className="text-xs text-gray-500 dark:text-gray-400">
                  PNG, JPG, GIF, or WebP. Max 10MB (will be compressed)
                </p>
                {imageFile && (
                  <p id={`${imageUploadId}-size`} className="text-xs text-ocean-medium">
                    <span className="sr-only">Selected image </span>
                    Size: {(imageFile.size / 1024).toFixed(1)}KB
                  </p>
                )}
                {isCompressing && (
                  <div className="text-xs text-ocean-medium" role="status" aria-live="polite">
                    <span className="sr-only">Image processing status: </span>
                    Processing image, please wait...
                  </div>
                )}
              </div>
            </div>
          </fieldset>
        
          {/* Basic Fields with accessibility */}
          <div className="space-y-4">
            <div>
              <label htmlFor={titleId} className="block text-sm font-medium text-ocean-medium dark:text-ocean-light mb-1">
                Title <span className="text-red-500" aria-label="required">*</span>
              </label>
              <input
                id={titleId}
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (e.target.value.trim() && secureForm.errors?.title) {
                    announceInfo('Title validation passed');
                  }
                }}
                onBlur={() => {
                  if (!title.trim()) {
                    announceError('Title is required');
                  }
                }}
                placeholder="Enter todo title"
                className="ocean-input w-full focus:ring-2 focus:ring-ocean-medium"
                required
                aria-required="true"
                aria-describedby={`${titleId}-help ${error ? errorId : ''}`}
                aria-invalid={secureForm.errors?.title ? 'true' : 'false'}
                maxLength={100}
                autoComplete="off"
              />
              <div id={`${titleId}-help`} className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Give your todo a descriptive title (required, max 100 characters)
              </div>
              {secureForm.errors?.title && (
                <div className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">
                  {secureForm.errors.title.message}
                </div>
              )}
            </div>
            
            <div>
              <label htmlFor={descriptionId} className="block text-sm font-medium text-ocean-medium dark:text-ocean-light mb-1">
                Description
              </label>
              <textarea
                id={descriptionId}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a detailed description"
                rows={4}
                className="ocean-input w-full resize-none focus:ring-2 focus:ring-ocean-medium"
                aria-describedby={`${descriptionId}-help`}
                maxLength={1000}
                autoComplete="off"
              />
              <div id={`${descriptionId}-help`} className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Provide additional details about your todo (optional, max 1000 characters)
              </div>
              {secureForm.errors?.description && (
                <div className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">
                  {secureForm.errors.description.message}
                </div>
              )}
            </div>
          
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="priority-select" className="block text-sm font-medium text-ocean-medium dark:text-ocean-light mb-1">
                  Priority
                </label>
                <select
                  id="priority-select"
                  value={priority}
                  onChange={(e) => {
                    const newPriority = e.target.value as 'low' | 'medium' | 'high';
                    setPriority(newPriority);
                    announceInfo(`Priority changed to ${newPriority}`);
                  }}
                  className="ocean-input w-full focus:ring-2 focus:ring-ocean-medium"
                  aria-describedby="priority-help"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <div id="priority-help" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Set the urgency level for this todo
                </div>
              </div>
              
              <div>
                <label htmlFor="category-select" className="block text-sm font-medium text-ocean-medium dark:text-ocean-light mb-1">
                  Category
                </label>
                <select
                  id="category-select"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    announceInfo(`Category changed to ${e.target.value}`);
                  }}
                  className="ocean-input w-full focus:ring-2 focus:ring-ocean-medium"
                  aria-describedby="category-help"
                >
                  <option value="personal">Personal</option>
                  <option value="work">Work</option>
                  <option value="shopping">Shopping</option>
                  <option value="health">Health</option>
                  <option value="finance">Finance</option>
                  <option value="other">Other</option>
                </select>
                <div id="category-help" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Choose the most appropriate category
                </div>
              </div>
              
              <div>
                <label htmlFor="due-date-input" className="block text-sm font-medium text-ocean-medium dark:text-ocean-light mb-1">
                  Due Date
                </label>
                <input
                  id="due-date-input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    if (e.target.value) {
                      const date = new Date(e.target.value);
                      announceInfo(`Due date set to ${date.toLocaleDateString()}`);
                    }
                  }}
                  className="ocean-input w-full focus:ring-2 focus:ring-ocean-medium"
                  aria-describedby="due-date-help"
                  min={new Date().toISOString().split('T')[0]}
                />
                <div id="due-date-help" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Optional target completion date
                </div>
              </div>
            </div>
            
            <div>
              <label htmlFor="tags-input" className="block text-sm font-medium text-ocean-medium dark:text-ocean-light mb-1">
                Tags (comma separated)
              </label>
              <input
                id="tags-input"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="work, urgent, project-x"
                className="ocean-input w-full focus:ring-2 focus:ring-ocean-medium"
                aria-describedby="tags-help"
                autoComplete="off"
              />
              <div id="tags-help" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Add tags separated by commas to help organize your todos (max 10 tags, 30 characters each)
              </div>
              {secureForm.errors?.tags && (
                <div className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">
                  {secureForm.errors.tags.message}
                </div>
              )}
            </div>
          </div>
        
          {/* Advanced Options with accessibility */}
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => {
                const newState = !showAdvanced;
                setShowAdvanced(newState);
                announceInfo(`Advanced options ${newState ? 'expanded' : 'collapsed'}`);
              }}
              onKeyDown={(e) => {
                if (isActionKey(e.key)) {
                  e.preventDefault();
                  const newState = !showAdvanced;
                  setShowAdvanced(newState);
                  announceInfo(`Advanced options ${newState ? 'expanded' : 'collapsed'}`);
                }
              }}
              className="flex items-center text-ocean-medium hover:text-ocean-deep transition-colors focus:outline-none focus:ring-2 focus:ring-ocean-medium rounded-md px-2 py-1"
              aria-expanded={showAdvanced}
              aria-controls={advancedOptionsId}
              id={`${advancedOptionsId}-toggle`}
            >
              <svg
                className={`w-4 h-4 mr-2 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced Options
            </button>
            
            {showAdvanced && (
              <div 
                id={advancedOptionsId}
                className="mt-4 space-y-4"
                role="region"
                aria-labelledby={`${advancedOptionsId}-toggle`}
              >
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="isPrivate"
                    checked={isPrivate}
                    onChange={(e) => {
                      setIsPrivate(e.target.checked);
                      announceInfo(`Privacy setting ${e.target.checked ? 'enabled' : 'disabled'}`);
                    }}
                    className="w-4 h-4 rounded text-ocean-medium focus:ring-ocean-light focus:ring-2 mt-0.5"
                    aria-describedby="privacy-help"
                  />
                  <div className="flex-1">
                    <label htmlFor="isPrivate" className="text-sm text-ocean-medium dark:text-ocean-light font-medium">
                      Make this NFT private
                    </label>
                    <div id="privacy-help" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      When enabled, only you can view this NFT. Others cannot see or interact with it.
                    </div>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="expiration-days" className="block text-sm font-medium text-ocean-medium dark:text-ocean-light mb-1">
                    Storage Duration (days)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      id="expiration-days"
                      type="number"
                      value={expirationDays}
                      onChange={(e) => {
                        const days = Math.max(1, Math.min(3650, parseInt(e.target.value) || 1));
                        setExpirationDays(days);
                        announceInfo(`Storage duration set to ${days} days`);
                      }}
                      min="1"
                      max="3650"
                      className="ocean-input w-32 focus:ring-2 focus:ring-ocean-medium"
                      aria-describedby="expiration-help"
                    />
                    <span className="text-sm text-gray-500" aria-live="polite">
                      ({Math.ceil(expirationDays / 30)} epochs)
                    </span>
                  </div>
                  <div id="expiration-help" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    How long to store your NFT data on Walrus (1-3650 days, approximately 1-122 epochs)
                  </div>
                </div>
              </div>
            )}
          </div>
        
          {/* Storage Cost Estimate with accessibility */}
          {estimatedCost && connected && (
            <div 
              className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
              role="region"
              aria-labelledby={`${costEstimateId}-title`}
              id={costEstimateId}
            >
              <h4 id={`${costEstimateId}-title`} className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                Estimated Storage Cost
              </h4>
              <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300" role="table" aria-label="Cost breakdown">
                <div className="flex justify-between" role="row">
                  <span role="rowheader">Data size:</span>
                  <span role="cell">{(estimatedSize / 1024).toFixed(2)} KB</span>
                </div>
                <div className="flex justify-between" role="row">
                  <span role="rowheader">Storage cost:</span>
                  <span role="cell">{estimatedCost.breakdown.storage} WAL</span>
                </div>
                <div className="flex justify-between" role="row">
                  <span role="rowheader">Transaction fees:</span>
                  <span role="cell">~{estimatedCost.breakdown.transaction} WAL</span>
                </div>
                <div className="flex justify-between font-medium pt-1 border-t border-blue-300 dark:border-blue-700" role="row">
                  <span role="rowheader">Total estimated cost:</span>
                  <span role="cell" className="font-semibold">{estimatedCost.totalCost} WAL</span>
                </div>
              </div>
              <div className="sr-only">
                <p>Total estimated cost for creating this NFT: {estimatedCost.totalCost} WAL tokens, including {estimatedCost.breakdown.storage} WAL for storage and approximately {estimatedCost.breakdown.transaction} WAL for transaction fees.</p>
              </div>
            </div>
          )}
        
          {/* Progress Bar with accessibility */}
          {isSubmitting && (
            <div 
              className="space-y-2"
              role="status"
              aria-live="polite"
              aria-labelledby={`${progressId}-label`}
              id={progressId}
            >
              <div className="flex justify-between text-sm text-ocean-medium">
                <span id={`${progressId}-label`}>{uploadStage}</span>
                <span aria-label={`Upload progress: ${uploadProgress} percent`}>{uploadProgress}%</span>
              </div>
              <div 
                className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"
                role="progressbar"
                aria-valuenow={uploadProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-labelledby={`${progressId}-label`}
              >
                <div
                  className="bg-ocean-medium h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="sr-only">
                NFT creation in progress: {uploadStage}. {uploadProgress}% complete.
              </div>
            </div>
          )}
        
          {/* Actions with accessibility */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-ocean-medium dark:text-ocean-light" role="status" aria-live="polite">
              {connected ? (
                <span>
                  Creating in: <span className="font-medium">{listName}</span> list
                  <span className="sr-only">. Form is ready for submission.</span>
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  <span className="sr-only">Warning: </span>
                  Connect wallet to create NFT
                </span>
              )}
            </div>
            
            <div className="flex space-x-3" role="group" aria-label="Form actions">
              {onCancel && (
                <button
                  type="button"
                  onClick={() => {
                    onCancel();
                    announceInfo('Form cancelled');
                  }}
                  onKeyDown={(e) => {
                    if (isActionKey(e.key)) {
                      e.preventDefault();
                      onCancel();
                      announceInfo('Form cancelled');
                    }
                  }}
                  disabled={isSubmitting}
                  className="ocean-button-secondary focus:ring-2 focus:ring-ocean-medium disabled:opacity-50"
                  aria-label="Cancel form and return to previous page"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  !title.trim() ||
                  !connected ||
                  !suiClientInitialized
                }
                className={`ocean-button focus:ring-2 focus:ring-ocean-medium ${
                  isSubmitting || !title.trim() || !connected || !suiClientInitialized
                    ? 'opacity-70 cursor-not-allowed'
                    : ''
                }`}
                aria-describedby={`${formId}-submit-help`}
                aria-label={
                  isSubmitting
                    ? 'Creating NFT in progress, please wait'
                    : !connected
                    ? 'Connect wallet to enable NFT creation'
                    : !suiClientInitialized
                    ? 'Initializing blockchain connection, please wait'
                    : !title.trim()
                    ? 'Enter a title to enable NFT creation'
                    : 'Create Todo NFT on blockchain'
                }
              >
                {isSubmitting
                  ? 'Creating NFT...'
                  : !connected
                  ? 'Connect Wallet'
                  : !suiClientInitialized
                  ? 'Initializing...'
                  : 'Create Todo NFT'}
              </button>
              <div id={`${formId}-submit-help`} className="sr-only">
                {isSubmitting
                  ? 'NFT creation is in progress. Please wait for completion.'
                  : !connected
                  ? 'A wallet connection is required to create NFTs on the blockchain.'
                  : !suiClientInitialized
                  ? 'Blockchain connection is being established.'
                  : !title.trim()
                  ? 'A title is required to create the NFT.'
                  : 'Submit the form to create your Todo as an NFT on the Sui blockchain.'}
              </div>
            </div>
          </div>
          
          {/* Live regions for announcements */}
          <StatusRegion />
        </form>
      </div>
    </AccessibilityAnnouncerProvider>
  );
}