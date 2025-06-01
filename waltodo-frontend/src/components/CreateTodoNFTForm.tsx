'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useClientSafeWallet } from '@/hooks/useClientSafeWallet';
import { useSuiClient } from '@/hooks/useSuiClient';
import { useWalrusStorage } from '@/hooks/useWalrusStorage';
import { storeTodoOnBlockchain } from '@/lib/sui-client';
import { storeTodoOnBlockchainSafely } from '@/lib/sui-client-safe';
import { createNFT, initializeOfflineSync } from '@/lib/todo-service-offline';
import toast from 'react-hot-toast';
import type { CreateTodoParams, Todo } from '@/types/todo-nft';

// Template presets
interface TodoTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  category: string;
  icon: string;
}

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
}

export default function CreateTodoNFTForm({
  listName = 'default',
  onTodoCreated,
  onCancel,
}: CreateTodoNFTFormProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [tags, setTags] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('personal');
  
  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  
  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [expirationDays, setExpirationDays] = useState(365); // Default 1 year
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  
  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Hooks
  const walletContext = useClientSafeWallet();
  const { address, connected, signAndExecuteTransaction } = walletContext || {};
  const { isInitialized: suiClientInitialized } = useSuiClient('testnet');
  const {
    createTodo: createWalrusTodo,
    estimateStorageCosts,
    loading: walrusLoading,
    progress: walrusProgress,
    progressMessage: walrusProgressMessage,
    error: walrusError,
  } = useWalrusStorage({ network: 'testnet' });
  
  // Estimated storage cost
  const [estimatedCost, setEstimatedCost] = useState<{
    totalCost: string;
    breakdown: { storage: string; transaction: string };
  } | null>(null);
  
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
    if (!connected || !address) return;
    
    try {
      const todoData = {
        title: title || 'Untitled',
        description,
        priority,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        category,
        dueDate: dueDate || undefined,
        completed: false,
      };
      
      const costs = await estimateStorageCosts([todoData], expirationDays / 30); // Convert days to epochs
      
      if (costs) {
        // Format costs for display
        const totalCostInWAL = Number(costs.totalCost) / 1e9; // Convert from MIST to WAL
        setEstimatedCost({
          totalCost: totalCostInWAL.toFixed(6),
          breakdown: {
            storage: (totalCostInWAL * 0.8).toFixed(6), // Approximate storage portion
            transaction: (totalCostInWAL * 0.2).toFixed(6), // Approximate transaction fees
          },
        });
      }
    } catch (err) {
      console.error('Failed to estimate costs:', err);
    }
  }, [connected, address, title, description, priority, tags, category, dueDate, expirationDays, estimateStorageCosts]);
  
  // Debounced cost estimate update
  React.useEffect(() => {
    const timer = setTimeout(updateCostEstimate, 500);
    return () => clearTimeout(timer);
  }, [updateCostEstimate]);
  
  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setTitle(template.title);
      setDescription(template.description);
      setPriority(template.priority);
      setTags(template.tags.join(', '));
      setCategory(template.category);
      setSelectedTemplate(templateId);
    }
  };
  
  // Handle image selection
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    
    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
      return;
    }
    
    setError(null);
    setIsCompressing(true);
    
    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      // Compress image if needed
      const compressedFile = await compressImage(file);
      setImageFile(compressedFile);
    } catch (err) {
      setError('Failed to process image');
      console.error('Image processing error:', err);
    } finally {
      setIsCompressing(false);
    }
  };
  
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
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    
    if (!connected || !address || !signAndExecuteTransaction) {
      setError('Please connect your wallet to create Todo NFTs');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    setUploadProgress(0);
    
    try {
      // Initialize offline sync with current signer
      initializeOfflineSync({ signAndExecuteTransaction, address });
      
      // Prepare todo data
      const todoData = {
        title: title.trim(),
        description: description.trim(),
        completed: false,
        priority,
        tags: tags
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean),
        dueDate: dueDate || undefined,
        category,
        isPrivate,
      };
      
      // Create NFT with offline support
      setUploadStage('Creating NFT...');
      setUploadProgress(30);
      
      const { todoId, objectId } = await createNFT(
        listName,
        todoData,
        imageFile || undefined,
        { signAndExecuteTransaction, address },
        address
      );
      
      if (!todoId) {
        throw new Error('Failed to generate todo ID');
      }
      
      if (!navigator.onLine) {
        toast.success('Todo created locally and queued for sync when online');
        setUploadProgress(100);
        if (onTodoCreated) {
          onTodoCreated({ id: todoId, ...todoData } as Todo);
        }
        resetForm();
        return;
      }
      
      if (!objectId) {
        throw new Error('Failed to create NFT on blockchain');
      }
      
      setUploadProgress(100);
      setUploadStage('Todo NFT created successfully!');
      
      // Success notification
      toast.success('Todo NFT created successfully! 🎉', {
        duration: 5000,
      });
      
      // Call success callback
      const createdTodo: Todo = {
        id: todoId,
        ...todoData,
        blockchainStored: true,
        objectId,
      };
      
      if (onTodoCreated) {
        onTodoCreated(createdTodo);
      }
      
      
      // Reset form
      resetForm();
      
    } catch (err) {
      console.error('Failed to create Todo NFT:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create Todo NFT';
      setError(errorMessage);
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setIsSubmitting(false);
      setUploadStage('');
    }
  };
  
  // Reset form
  const resetForm = () => {
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
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-ocean-deep dark:text-ocean-light">
            Create Todo NFT
          </h2>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-ocean-medium hover:text-ocean-deep transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
        
        {/* Error display */}
        {(error || walrusError) && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-700 dark:text-red-300">
              {error || walrusError?.message}
            </p>
          </div>
        )}
        
        {/* Templates */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-ocean-medium dark:text-ocean-light">
            Start with a template (optional)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleTemplateSelect(template.id)}
                className={`p-3 rounded-lg border transition-all ${
                  selectedTemplate === template.id
                    ? 'border-ocean-deep bg-ocean-light/10 dark:border-ocean-light dark:bg-ocean-deep/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-ocean-medium'
                }`}
              >
                <div className="text-2xl mb-1">{template.icon}</div>
                <div className="text-sm font-medium">{template.name}</div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Image Upload */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-ocean-medium dark:text-ocean-light">
            NFT Image
          </label>
          <div className="flex items-start space-x-4">
            {/* Image Preview */}
            <div className="flex-shrink-0">
              {imagePreview ? (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-ocean-light">
                  <Image
                    src={imagePreview}
                    alt="NFT preview"
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
                    }}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressing}
                className="ocean-button-secondary"
              >
                {isCompressing ? 'Processing...' : 'Choose Image'}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                PNG, JPG, GIF, or WebP. Max 10MB (will be compressed)
              </p>
              {imageFile && (
                <p className="text-xs text-ocean-medium">
                  Size: {(imageFile.size / 1024).toFixed(1)}KB
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Basic Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ocean-medium dark:text-ocean-light mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter todo title"
              className="ocean-input w-full"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-ocean-medium dark:text-ocean-light mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a detailed description"
              rows={4}
              className="ocean-input w-full resize-none"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-ocean-medium dark:text-ocean-light mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="ocean-input w-full"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-ocean-medium dark:text-ocean-light mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="ocean-input w-full"
              >
                <option value="personal">Personal</option>
                <option value="work">Work</option>
                <option value="shopping">Shopping</option>
                <option value="health">Health</option>
                <option value="finance">Finance</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-ocean-medium dark:text-ocean-light mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="ocean-input w-full"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-ocean-medium dark:text-ocean-light mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="work, urgent, project-x"
              className="ocean-input w-full"
            />
          </div>
        </div>
        
        {/* Advanced Options */}
        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-ocean-medium hover:text-ocean-deep transition-colors"
          >
            <svg
              className={`w-4 h-4 mr-2 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Advanced Options
          </button>
          
          {showAdvanced && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 rounded text-ocean-medium focus:ring-ocean-light"
                />
                <label htmlFor="isPrivate" className="ml-2 text-sm text-ocean-medium dark:text-ocean-light">
                  Make this NFT private (only you can view it)
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-ocean-medium dark:text-ocean-light mb-1">
                  Storage Duration (days)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={expirationDays}
                    onChange={(e) => setExpirationDays(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max="3650"
                    className="ocean-input w-32"
                  />
                  <span className="text-sm text-gray-500">
                    ({Math.ceil(expirationDays / 30)} epochs)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Storage Cost Estimate */}
        {estimatedCost && connected && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              Estimated Storage Cost
            </h4>
            <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <div className="flex justify-between">
                <span>Data size:</span>
                <span>{(estimatedSize / 1024).toFixed(2)} KB</span>
              </div>
              <div className="flex justify-between">
                <span>Storage cost:</span>
                <span>{estimatedCost.breakdown.storage} WAL</span>
              </div>
              <div className="flex justify-between">
                <span>Transaction fees:</span>
                <span>~{estimatedCost.breakdown.transaction} WAL</span>
              </div>
              <div className="flex justify-between font-medium pt-1 border-t border-blue-300 dark:border-blue-700">
                <span>Total:</span>
                <span>{estimatedCost.totalCost} WAL</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Progress Bar */}
        {isSubmitting && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-ocean-medium">
              <span>{uploadStage || walrusProgressMessage}</span>
              <span>{uploadProgress || walrusProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-ocean-medium h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress || walrusProgress}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-ocean-medium dark:text-ocean-light">
            {connected ? (
              <span>Creating in: <span className="font-medium">{listName}</span></span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">
                Connect wallet to create NFT
              </span>
            )}
          </div>
          
          <div className="flex space-x-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="ocean-button-secondary"
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
                !suiClientInitialized ||
                walrusLoading
              }
              className={`ocean-button ${
                isSubmitting || !title.trim() || !connected || !suiClientInitialized
                  ? 'opacity-70 cursor-not-allowed'
                  : ''
              }`}
            >
              {isSubmitting
                ? 'Creating NFT...'
                : !connected
                ? 'Connect Wallet'
                : !suiClientInitialized
                ? 'Initializing...'
                : 'Create Todo NFT'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}