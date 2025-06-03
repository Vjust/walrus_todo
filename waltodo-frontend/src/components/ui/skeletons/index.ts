/**
 * Skeleton Components Index
 * 
 * Centralized exports for all skeleton loading components
 */

import React from 'react';

// Individual skeleton components
export { 
  TodoCardSkeleton, 
  TodoCardSkeletonGrid,
  type TodoCardSkeletonProps,
  type TodoCardSkeletonGridProps 
} from './TodoCardSkeleton';

export { 
  TodoListSkeleton, 
  TodoListEmptySkeleton,
  type TodoListSkeletonProps 
} from './TodoListSkeleton';

export { 
  NFTImageSkeleton, 
  NFTImageGallerySkeleton, 
  NFTHeroImageSkeleton,
  type NFTImageSkeletonProps,
  type NFTImageGallerySkeletonProps 
} from './NFTImageSkeleton';

export { 
  StatsSkeleton, 
  KPIDashboardSkeleton, 
  CompactStatsSkeleton, 
  ProgressStatsSkeleton,
  type StatsSkeletonProps,
  type KPIDashboardSkeletonProps,
  type CompactStatsSkeletonProps 
} from './StatsSkeleton';

// Common skeleton utilities
export const SKELETON_ANIMATION_SPEEDS = {
  slow: 'animate-pulse-slow',
  normal: 'animate-pulse',
  fast: 'animate-pulse-fast',
} as const;

export const SKELETON_VARIANTS = {
  pulse: 'animate-pulse',
  shimmer: 'animate-shimmer', 
  wave: 'animate-wave',
  none: '',
} as const;

export type SkeletonAnimationSpeed = keyof typeof SKELETON_ANIMATION_SPEEDS;
export type SkeletonVariant = keyof typeof SKELETON_VARIANTS;

/**
 * Get skeleton animation class based on speed
 */
export function getSkeletonAnimation(speed: SkeletonAnimationSpeed = 'normal'): string {
  return SKELETON_ANIMATION_SPEEDS[speed];
}

/**
 * Get skeleton variant class
 */
export function getSkeletonVariant(variant: SkeletonVariant = 'pulse'): string {
  return SKELETON_VARIANTS[variant];
}

/**
 * Generate skeleton classes with base styling
 */
export function generateSkeletonClasses(
  variant: SkeletonVariant = 'pulse',
  baseClasses = 'bg-gray-200 dark:bg-gray-700 rounded'
): string {
  return `${baseClasses} ${getSkeletonVariant(variant)}`;
}

/**
 * Stagger delay calculator for skeleton animations
 */
export function calculateStaggerDelay(index: number, baseDelay = 100): React.CSSProperties {
  return { animationDelay: `${index * baseDelay}ms` };
}

/**
 * Common skeleton configurations
 */
export const SKELETON_CONFIGS = {
  fast: {
    animationSpeed: 'fast' as SkeletonAnimationSpeed,
    variant: 'pulse' as SkeletonVariant,
  },
  normal: {
    animationSpeed: 'normal' as SkeletonAnimationSpeed,
    variant: 'pulse' as SkeletonVariant,
  },
  slow: {
    animationSpeed: 'slow' as SkeletonAnimationSpeed,
    variant: 'shimmer' as SkeletonVariant,
  },
  elegant: {
    animationSpeed: 'normal' as SkeletonAnimationSpeed,
    variant: 'shimmer' as SkeletonVariant,
  },
} as const;

export type SkeletonConfig = keyof typeof SKELETON_CONFIGS;

/**
 * Get skeleton configuration
 */
export function getSkeletonConfig(config: SkeletonConfig = 'normal') {
  return SKELETON_CONFIGS[config];
}

/**
 * Skeleton wrapper component for consistent styling
 */
export interface SkeletonWrapperProps {
  children: React.ReactNode;
  loading?: boolean;
  skeleton: React.ReactNode;
  className?: string;
}

export const SkeletonWrapper: React.FC<SkeletonWrapperProps> = ({
  children,
  loading = false,
  skeleton,
  className = ''
}) => {
  if (loading) {
    return <div className={className}>{skeleton}</div>;
  }
  
  return <div className={className}>{children}</div>;
};

// Re-export React for convenience
export { type ReactNode } from 'react';