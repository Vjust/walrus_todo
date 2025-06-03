import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface TodoTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  category: string;
  icon: string;
}

export interface CreateTodoNFTState {
  // Form state
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  tags: string;
  dueDate: string;
  category: string;
  
  // Image state
  imageFile: File | null;
  imagePreview: string | null;
  isCompressing: boolean;
  
  // Advanced options
  showAdvanced: boolean;
  isPrivate: boolean;
  expirationDays: number;
  selectedTemplate: string | null;
  
  // Loading states
  isSubmitting: boolean;
  uploadProgress: number;
  uploadStage: string;
  error: string | null;
  
  // Storage cost estimate
  estimatedCost: {
    totalCost: string;
    breakdown: { storage: string; transaction: string };
  } | null;
  
  // Actions
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setPriority: (priority: 'low' | 'medium' | 'high') => void;
  setTags: (tags: string) => void;
  setDueDate: (dueDate: string) => void;
  setCategory: (category: string) => void;
  setImageFile: (file: File | null) => void;
  setImagePreview: (preview: string | null) => void;
  setIsCompressing: (isCompressing: boolean) => void;
  setShowAdvanced: (showAdvanced: boolean) => void;
  setIsPrivate: (isPrivate: boolean) => void;
  setExpirationDays: (days: number) => void;
  setSelectedTemplate: (templateId: string | null) => void;
  setIsSubmitting: (isSubmitting: boolean) => void;
  setUploadProgress: (progress: number) => void;
  setUploadStage: (stage: string) => void;
  setError: (error: string | null) => void;
  setEstimatedCost: (cost: CreateTodoNFTState['estimatedCost']) => void;
  
  // Utility actions
  applyTemplate: (template: TodoTemplate) => void;
  resetForm: () => void;
}

const initialState = {
  title: '',
  description: '',
  priority: 'medium' as const,
  tags: '',
  dueDate: '',
  category: 'personal',
  imageFile: null,
  imagePreview: null,
  isCompressing: false,
  showAdvanced: false,
  isPrivate: false,
  expirationDays: 365,
  selectedTemplate: null,
  isSubmitting: false,
  uploadProgress: 0,
  uploadStage: '',
  error: null,
  estimatedCost: null,
};

export const useCreateTodoNFTStore = create<CreateTodoNFTState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    // Basic form setters
    setTitle: (title: string) => set({ title }),
    setDescription: (description: string) => set({ description }),
    setPriority: (priority: 'low' | 'medium' | 'high') => set({ priority }),
    setTags: (tags: string) => set({ tags }),
    setDueDate: (dueDate: string) => set({ dueDate }),
    setCategory: (category: string) => set({ category }),
    
    // Image setters
    setImageFile: (imageFile: File | null) => set({ imageFile }),
    setImagePreview: (imagePreview: string | null) => set({ imagePreview }),
    setIsCompressing: (isCompressing: boolean) => set({ isCompressing }),
    
    // Advanced options setters
    setShowAdvanced: (showAdvanced: boolean) => set({ showAdvanced }),
    setIsPrivate: (isPrivate: boolean) => set({ isPrivate }),
    setExpirationDays: (expirationDays: number) => set({ expirationDays }),
    setSelectedTemplate: (selectedTemplate: string | null) => set({ selectedTemplate }),
    
    // Loading state setters
    setIsSubmitting: (isSubmitting: boolean) => set({ isSubmitting }),
    setUploadProgress: (uploadProgress: number) => set({ uploadProgress }),
    setUploadStage: (uploadStage: string) => set({ uploadStage }),
    setError: (error: string | null) => set({ error }),
    setEstimatedCost: (estimatedCost: CreateTodoNFTState['estimatedCost']) => set({ estimatedCost }),
    
    // Utility actions
    applyTemplate: (template: TodoTemplate) => {
      set({
        title: template.title,
        description: template.description,
        priority: template.priority,
        tags: template.tags.join(', '),
        category: template.category,
        selectedTemplate: template.id,
      });
    },
    
    resetForm: () => {
      set({
        ...initialState,
        // Don't reset error state immediately to allow user to see any errors
      });
    },
  }))
);

// Selectors for performance optimization
export const useCreateTodoNFTFormData = () => {
  return useCreateTodoNFTStore((state) => ({
    title: state.title,
    description: state.description,
    priority: state.priority,
    tags: state.tags,
    dueDate: state.dueDate,
    category: state.category,
  }));
};

export const useCreateTodoNFTImageState = () => {
  return useCreateTodoNFTStore((state) => ({
    imageFile: state.imageFile,
    imagePreview: state.imagePreview,
    isCompressing: state.isCompressing,
  }));
};

export const useCreateTodoNFTLoadingState = () => {
  return useCreateTodoNFTStore((state) => ({
    isSubmitting: state.isSubmitting,
    uploadProgress: state.uploadProgress,
    uploadStage: state.uploadStage,
    error: state.error,
  }));
};

export const useCreateTodoNFTAdvancedOptions = () => {
  return useCreateTodoNFTStore((state) => ({
    showAdvanced: state.showAdvanced,
    isPrivate: state.isPrivate,
    expirationDays: state.expirationDays,
  }));
};