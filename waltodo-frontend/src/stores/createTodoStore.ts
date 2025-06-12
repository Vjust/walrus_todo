import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface CreateTodoState {
  // Form fields
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  tags: string;
  dueDate: string;
  
  // Options
  useAI: boolean;
  createOnBlockchain: boolean;
  
  // State tracking
  isSubmitting: boolean;
  isCreatingOnChain: boolean;
  componentMounted: boolean;
  error: string | null;
  
  // Actions
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setPriority: (priority: 'low' | 'medium' | 'high') => void;
  setTags: (tags: string) => void;
  setDueDate: (dueDate: string) => void;
  setUseAI: (useAI: boolean) => void;
  setCreateOnBlockchain: (createOnBlockchain: boolean) => void;
  setIsSubmitting: (isSubmitting: boolean) => void;
  setIsCreatingOnChain: (isCreatingOnChain: boolean) => void;
  setComponentMounted: (mounted: boolean) => void;
  setError: (error: string | null) => void;
  
  // Utility actions
  resetForm: () => void;
  getFormData: () => {
    title: string;
    description?: string;
    completed: boolean;
    priority: 'low' | 'medium' | 'high';
    tags?: string[];
    dueDate?: string;
  };
}

const initialState = {
  title: '',
  description: '',
  priority: 'medium' as const,
  tags: '',
  dueDate: '',
  useAI: false,
  createOnBlockchain: false,
  isSubmitting: false,
  isCreatingOnChain: false,
  componentMounted: false,
  error: null,
};

export const useCreateTodoStore = create<CreateTodoState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    // Form field setters
    setTitle: (title: string) => set({ title }),
    setDescription: (description: string) => set({ description }),
    setPriority: (priority: 'low' | 'medium' | 'high') => set({ priority }),
    setTags: (tags: string) => set({ tags }),
    setDueDate: (dueDate: string) => set({ dueDate }),
    
    // Option setters
    setUseAI: (useAI: boolean) => set({ useAI }),
    setCreateOnBlockchain: (createOnBlockchain: boolean) => set({ createOnBlockchain }),
    
    // State setters
    setIsSubmitting: (isSubmitting: boolean) => set({ isSubmitting }),
    setIsCreatingOnChain: (isCreatingOnChain: boolean) => set({ isCreatingOnChain }),
    setComponentMounted: (componentMounted: boolean) => set({ componentMounted }),
    setError: (error: string | null) => set({ error }),
    
    // Utility actions
    resetForm: () => {
      set({
        title: '',
        description: '',
        priority: 'medium' as const,
        tags: '',
        dueDate: '',
        useAI: false,
        error: null,
      });
    },
    
    getFormData: () => {
      const state = get();
      return {
        title: state?.title?.trim(),
        description: state?.description?.trim() || undefined,
        completed: false,
        priority: state.priority,
        tags: state.tags
          ? state.tags
              .split(',')
              .map(tag => tag.trim())
              .filter(Boolean as any)
          : undefined,
        dueDate: state.dueDate || undefined,
      };
    },
  }))
);

// Selectors for performance optimization
export const useCreateTodoFormData = () => {
  return useCreateTodoStore((state) => ({
    title: state.title,
    description: state.description,
    priority: state.priority,
    tags: state.tags,
    dueDate: state.dueDate,
  }));
};

export const useCreateTodoOptions = () => {
  return useCreateTodoStore((state) => ({
    useAI: state.useAI,
    createOnBlockchain: state.createOnBlockchain,
  }));
};

export const useCreateTodoLoadingState = () => {
  return useCreateTodoStore((state) => ({
    isSubmitting: state.isSubmitting,
    isCreatingOnChain: state.isCreatingOnChain,
    error: state.error,
  }));
};

export const useCreateTodoComponentState = () => {
  return useCreateTodoStore((state) => ({
    componentMounted: state.componentMounted,
  }));
};