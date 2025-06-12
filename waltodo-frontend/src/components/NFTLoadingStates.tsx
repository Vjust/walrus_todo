'use client';

import React from 'react';

// Individual skeleton components for reusability
export const ImageSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative overflow-hidden bg-gray-200 dark:bg-gray-700 ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent" />
  </div>
);

export const TextSkeleton: React.FC<{ className?: string; width?: string }> = ({ 
  className = '', 
  width = 'w-full' 
}) => (
  <div className={`h-4 rounded bg-gray-200 dark:bg-gray-700 relative overflow-hidden ${width} ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent" />
  </div>
);

export const ButtonSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 relative overflow-hidden ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent" />
  </div>
);

// Card skeleton for grid view
export const NFTCardSkeleton: React?.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
    {/* Image skeleton */}
    <ImageSkeleton className="w-full h-48" />
    
    {/* Content skeleton */}
    <div className="p-4 space-y-3">
      {/* Title */}
      <TextSkeleton width="w-3/4" />
      
      {/* Description lines */}
      <div className="space-y-2">
        <TextSkeleton width="w-full" />
        <TextSkeleton width="w-5/6" />
      </div>
      
      {/* Metadata */}
      <div className="flex items-center justify-between pt-2">
        <TextSkeleton width="w-20" className="h-3" />
        <TextSkeleton width="w-16" className="h-3" />
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <ButtonSkeleton className="flex-1" />
        <ButtonSkeleton className="w-10 h-10" />
      </div>
    </div>
  </div>
);

// Row skeleton for list view
export const NFTRowSkeleton: React?.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center gap-4">
    {/* Thumbnail */}
    <ImageSkeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
    
    {/* Content */}
    <div className="flex-1 space-y-2">
      <TextSkeleton width="w-1/3" />
      <TextSkeleton width="w-1/2" className="h-3" />
    </div>
    
    {/* Metadata */}
    <div className="flex flex-col items-end gap-2">
      <TextSkeleton width="w-20" className="h-3" />
      <ButtonSkeleton className="h-8 w-20" />
    </div>
  </div>
);

// Multi-step operation progress
export const OperationProgress: React.FC<{
  steps: string[];
  currentStep: number;
  message?: string;
}> = ({ steps, currentStep, message }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 max-w-md mx-auto">
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="relative">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-500 ease-out"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
      
      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div 
            key={index}
            className={`flex items-center gap-3 transition-opacity duration-300 ${
              index === currentStep 
                ? 'opacity-100' 
                : index < currentStep 
                  ? 'opacity-50' 
                  : 'opacity-30'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              index < currentStep 
                ? 'bg-green-500 text-white' 
                : index === currentStep 
                  ? 'bg-blue-500 text-white animate-pulse' 
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
            }`}>
              {index < currentStep ? '✓' : index + 1}
            </div>
            <span className={`text-sm ${
              index === currentStep 
                ? 'text-gray-900 dark:text-white font-medium' 
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {step}
            </span>
          </div>
        ))}
      </div>
      
      {/* Current message */}
      {message && (
        <div className="pt-2 text-sm text-gray-600 dark:text-gray-400 animate-pulse">
          {message}
        </div>
      )}
    </div>
  </div>
);

// Animated loading indicator
export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };
  
  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <svg className="animate-spin" viewBox="0 0 24 24" fill="none">
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4"
        />
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5?.291A7?.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};

// Loading text variations
export const LoadingText: React.FC<{ 
  variant?: 'dots' | 'pulse' | 'fade';
  text?: string;
  className?: string;
}> = ({ variant = 'dots', text = 'Loading', className = '' }) => {
  const [dots, setDots] = React.useState('');
  
  React.useEffect(() => {
    if (variant === 'dots') {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? '' : `${prev  }.`);
      }, 500);
      return () => clearInterval(interval as any);
    }
  }, [variant]);
  
  const variantClasses = {
    dots: '',
    pulse: 'animate-pulse',
    fade: 'animate-fade-in-out'
  };
  
  return (
    <span className={`text-gray-600 dark:text-gray-400 ${variantClasses[variant]} ${className}`}>
      {text}{variant === 'dots' && dots}
    </span>
  );
};

// Image loading placeholder with icon
export const ImageLoadingPlaceholder: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${className}`}>
    <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-gradient" />
    <svg 
      className="w-12 h-12 text-gray-400 dark:text-gray-600 animate-pulse relative z-10" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={1.5} 
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
      />
    </svg>
  </div>
);

// Grid skeleton container
export const NFTGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: count }).map((_, index) => (
      <NFTCardSkeleton key={index} />
    ))}
  </div>
);

// List skeleton container
export const NFTListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, index) => (
      <NFTRowSkeleton key={index} />
    ))}
  </div>
);

// Full page loading state
export const NFTPageLoading: React.FC<{ message?: string }> = ({ message }) => (
  <div className="min-h-[400px] flex flex-col items-center justify-center">
    <LoadingSpinner size="lg" className="text-blue-500 dark:text-blue-400 mb-4" />
    <LoadingText variant="dots" text={message || "Loading NFTs"} className="text-lg" />
  </div>
);

// Add CSS for animations (should be in globals.css)
const animationStyles = `
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}

@keyframes fade-in-out {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

@keyframes gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}

.animate-fade-in-out {
  animation: fade-in-out 2s ease-in-out infinite;
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradient 3s ease infinite;
}
`;

// Export a style tag component for the animations
export const NFTLoadingStyles = () => (
  <style>{animationStyles}</style>
);

// Main component that showcases all loading states
const NFTLoadingStates: React.FC<{
  variant?: 'grid' | 'list' | 'page' | 'operation';
  count?: number;
  operationSteps?: string[];
  currentStep?: number;
  message?: string;
}> = ({ 
  variant = 'grid', 
  count, 
  operationSteps = ['Uploading image', 'Creating metadata', 'Minting NFT', 'Confirming transaction'],
  currentStep = 0,
  message 
}) => {
  switch (variant) {
    case 'grid':
      return <NFTGridSkeleton count={count} />;
    case 'list':
      return <NFTListSkeleton count={count} />;
    case 'page':
      return <NFTPageLoading message={message} />;
    case 'operation':
      return <OperationProgress steps={operationSteps} currentStep={currentStep} message={message} />;
    default:
      return <NFTGridSkeleton count={count} />;
  }
};

export default NFTLoadingStates;