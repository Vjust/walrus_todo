'use client';

import React, { memo } from 'react';

export interface StatsSkeletonProps {
  /** Number of stat cards to render */
  cardCount?: number;
  /** Layout variant */
  variant?: 'horizontal' | 'grid' | 'vertical';
  /** Card size */
  size?: 'sm' | 'md' | 'lg';
  /** Animation speed */
  animationSpeed?: 'slow' | 'normal' | 'fast';
  /** Whether to show icons */
  showIcons?: boolean;
  /** Whether to show trend indicators */
  showTrends?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * StatsSkeleton Component
 * 
 * A skeleton loading component for statistics cards and dashboards.
 * Supports various layouts and customization options.
 */
const StatsSkeletonComponent: React.FC<StatsSkeletonProps> = ({
  cardCount = 4,
  variant = 'grid',
  size = 'md',
  animationSpeed = 'normal',
  showIcons = true,
  showTrends = false,
  className = ''
}) => {
  const animationClass = {
    slow: 'animate-pulse-slow',
    normal: 'animate-pulse',
    fast: 'animate-pulse-fast'
  }[animationSpeed];

  const getLayoutClasses = () => {
    switch (variant) {
      case 'horizontal':
        return 'flex flex-wrap gap-4';
      case 'vertical':
        return 'space-y-4';
      case 'grid':
      default:
        return `grid gap-4 ${
          cardCount <= 2 
            ? 'grid-cols-1 md:grid-cols-2' 
            : cardCount === 3 
            ? 'grid-cols-1 md:grid-cols-3'
            : 'grid-cols-2 md:grid-cols-4'
        }`;
    }
  };

  return (
    <div className={`${getLayoutClasses()} ${className}`}>
      {Array.from({ length: cardCount }).map((_, index) => (
        <StatCardSkeleton
          key={index}
          size={size}
          animationClass={animationClass}
          showIcon={showIcons}
          showTrend={showTrends}
          delay={index * 100}
        />
      ))}
    </div>
  );
};

export const StatsSkeleton = memo(StatsSkeletonComponent);
StatsSkeleton.displayName = 'StatsSkeleton';

interface StatCardSkeletonProps {
  size: 'sm' | 'md' | 'lg';
  animationClass: string;
  showIcon: boolean;
  showTrend: boolean;
  delay?: number;
}

const StatCardSkeletonComponent: React.FC<StatCardSkeletonProps> = ({
  size,
  animationClass,
  showIcon,
  showTrend,
  delay = 0
}) => {
  const style = delay > 0 ? { animationDelay: `${delay}ms` } : undefined;

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'p-3';
      case 'lg':
        return 'p-8';
      case 'md':
      default:
        return 'p-6';
    }
  };

  const getValueSize = () => {
    switch (size) {
      case 'sm':
        return 'h-6';
      case 'lg':
        return 'h-10';
      case 'md':
      default:
        return 'h-8';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-6 h-6';
      case 'lg':
        return 'w-10 h-10';
      case 'md':
      default:
        return 'w-8 h-8';
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${getSizeClasses()}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          {/* Label */}
          <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 ${animationClass}`} style={style} />
          
          {/* Value */}
          <div className={`${getValueSize()} bg-gray-200 dark:bg-gray-700 rounded w-16 ${animationClass}`} style={style} />
          
          {/* Trend indicator */}
          {showTrend && (
            <div className="flex items-center gap-1">
              <div className={`w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} style={style} />
              <div className={`h-3 bg-gray-200 dark:bg-gray-700 rounded w-8 ${animationClass}`} style={style} />
            </div>
          )}
        </div>
        
        {/* Icon */}
        {showIcon && (
          <div className={`${getIconSize()} bg-gray-200 dark:bg-gray-700 rounded-lg ${animationClass}`} style={style} />
        )}
      </div>
    </div>
  );
};

const StatCardSkeleton = memo(StatCardSkeletonComponent);
StatCardSkeleton.displayName = 'StatCardSkeleton';

/**
 * KPI Dashboard Skeleton
 * 
 * A comprehensive skeleton for KPI dashboards with various metrics
 */
export interface KPIDashboardSkeletonProps {
  /** Animation speed */
  animationSpeed?: 'slow' | 'normal' | 'fast';
  /** Whether to show chart area */
  showCharts?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const KPIDashboardSkeleton: React.FC<KPIDashboardSkeletonProps> = ({
  animationSpeed = 'normal',
  showCharts = true,
  className = ''
}) => {
  const animationClass = {
    slow: 'animate-pulse-slow',
    normal: 'animate-pulse',
    fast: 'animate-pulse-fast'
  }[animationSpeed];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className={`h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 ${animationClass}`} />
          <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 ${animationClass}`} />
        </div>
        <div className={`w-32 h-10 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} />
      </div>

      {/* Primary stats */}
      <StatsSkeleton
        cardCount={4}
        variant="grid"
        size="lg"
        animationSpeed={animationSpeed}
        showIcons={true}
        showTrends={true}
      />

      {/* Charts section */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="space-y-4">
              <div className={`h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 ${animationClass}`} />
              <div className={`h-64 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} />
            </div>
          </div>

          {/* Chart 2 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="space-y-4">
              <div className={`h-6 bg-gray-200 dark:bg-gray-700 rounded w-40 ${animationClass}`} />
              <div className={`h-64 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} />
            </div>
          </div>
        </div>
      )}

      {/* Secondary stats */}
      <StatsSkeleton
        cardCount={3}
        variant="grid"
        size="md"
        animationSpeed={animationSpeed}
        showIcons={false}
        showTrends={false}
      />
    </div>
  );
};

/**
 * Compact Stats Row Skeleton
 * 
 * Horizontal layout for showing key metrics in a compact format
 */
export interface CompactStatsSkeletonProps {
  /** Number of metrics to show */
  metricCount?: number;
  /** Whether to show separators between metrics */
  showSeparators?: boolean;
  /** Animation speed */
  animationSpeed?: 'slow' | 'normal' | 'fast';
  /** Additional CSS classes */
  className?: string;
}

export const CompactStatsSkeleton: React.FC<CompactStatsSkeletonProps> = ({
  metricCount = 3,
  showSeparators = true,
  animationSpeed = 'normal',
  className = ''
}) => {
  const animationClass = {
    slow: 'animate-pulse-slow',
    normal: 'animate-pulse',
    fast: 'animate-pulse-fast'
  }[animationSpeed];

  return (
    <div className={`flex items-center space-x-6 ${className}`}>
      {Array.from({ length: metricCount }).map((_, index) => (
        <React.Fragment key={index}>
          <div className="text-center space-y-1">
            <div className={`h-6 bg-gray-200 dark:bg-gray-700 rounded w-12 mx-auto ${animationClass}`} style={{ animationDelay: `${index * 50}ms` }} />
            <div className={`h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mx-auto ${animationClass}`} style={{ animationDelay: `${index * 50 + 25}ms` }} />
          </div>
          
          {showSeparators && index < metricCount - 1 && (
            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * Progress Stats Skeleton
 * 
 * Shows skeleton for stats with progress bars
 */
export const ProgressStatsSkeleton: React.FC<{
  itemCount?: number;
  animationSpeed?: 'slow' | 'normal' | 'fast';
  className?: string;
}> = ({
  itemCount = 4,
  animationSpeed = 'normal',
  className = ''
}) => {
  const animationClass = {
    slow: 'animate-pulse-slow',
    normal: 'animate-pulse',
    fast: 'animate-pulse-fast'
  }[animationSpeed];

  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 ${animationClass}`} style={{ animationDelay: `${index * 50}ms` }} />
            <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded w-12 ${animationClass}`} style={{ animationDelay: `${index * 50 + 25}ms` }} />
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className={`bg-gray-300 dark:bg-gray-600 h-2 rounded-full ${animationClass}`}
              style={{ 
                width: `${Math.random() * 80 + 20}%`,
                animationDelay: `${index * 50 + 50}ms`
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsSkeleton;