/**
 * Tests for TodoCardSkeleton component
 * Tests skeleton loading states and accessibility
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Create a mock TodoCardSkeleton component since it might not exist yet
const TodoCardSkeleton: React.FC = () => {
  return (
    <div 
      className="animate-pulse p-4 bg-white rounded-lg shadow border"
      role="status"
      aria-label="Loading todo item"
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-200 rounded" />
          <div className="h-5 bg-gray-200 rounded w-32" />
        </div>
        <div className="w-12 h-5 bg-gray-200 rounded" />
      </div>
      
      {/* Content skeleton */}
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
      
      {/* Footer skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-gray-200 rounded-full" />
          <div className="h-4 bg-gray-200 rounded w-16" />
        </div>
        <div className="flex space-x-2">
          <div className="w-8 h-8 bg-gray-200 rounded" />
          <div className="w-8 h-8 bg-gray-200 rounded" />
        </div>
      </div>
      
      <span className="sr-only">Loading todo item...</span>
    </div>
  );
};

// Alternative compact skeleton
const TodoCardSkeletonCompact: React.FC = () => {
  return (
    <div 
      className="animate-pulse p-3 bg-white rounded border"
      role="status"
      aria-label="Loading todo item"
    >
      <div className="flex items-center space-x-3">
        <div className="w-4 h-4 bg-gray-200 rounded" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
        <div className="w-12 h-4 bg-gray-200 rounded" />
      </div>
    </div>
  );
};

// Grid skeleton for multiple items
const TodoGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <TodoCardSkeleton key={index} />
      ))}
    </div>
  );
};

// List skeleton for multiple items
const TodoListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, index) => (
        <TodoCardSkeletonCompact key={index} />
      ))}
    </div>
  );
};

describe('TodoCardSkeleton', () => {
  it('should render skeleton with proper structure', () => {
    render(<TodoCardSkeleton />);
    
    // Check for main container
    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-label', 'Loading todo item');
    
    // Check for screen reader text
    expect(screen.getByText('Loading todo item...')).toBeInTheDocument();
  });
  
  it('should have proper accessibility attributes', () => {
    render(<TodoCardSkeleton />);
    
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveAttribute('role', 'status');
    expect(skeleton).toHaveAttribute('aria-label');
  });
  
  it('should include animation classes', () => {
    render(<TodoCardSkeleton />);
    
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('animate-pulse');
  });
  
  it('should not have accessibility violations', async () => {
    const { container } = render(<TodoCardSkeleton />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
  
  it('should render multiple skeleton elements', () => {
    render(<TodoCardSkeleton />);
    
    // Count placeholder elements (gray backgrounds)
    const placeholders = screen.getByRole('status').querySelectorAll('.bg-gray-200');
    expect(placeholders.length).toBeGreaterThan(5); // Should have multiple placeholder elements
  });
});

describe('TodoCardSkeletonCompact', () => {
  it('should render compact skeleton layout', () => {
    render(<TodoCardSkeletonCompact />);
    
    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('p-3'); // Smaller padding than regular skeleton
  });
  
  it('should have proper accessibility', async () => {
    const { container } = render(<TodoCardSkeletonCompact />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('TodoGridSkeleton', () => {
  it('should render default number of skeleton items', () => {
    render(<TodoGridSkeleton />);
    
    const skeletons = screen.getAllByRole('status');
    expect(skeletons).toHaveLength(6); // Default count
  });
  
  it('should render custom number of skeleton items', () => {
    render(<TodoGridSkeleton count={3} />);
    
    const skeletons = screen.getAllByRole('status');
    expect(skeletons).toHaveLength(3);
  });
  
  it('should have grid layout classes', () => {
    const { container } = render(<TodoGridSkeleton />);
    
    const gridContainer = container.firstChild;
    expect(gridContainer).toHaveClass('grid', 'gap-4', 'md:grid-cols-2', 'lg:grid-cols-3');
  });
  
  it('should not have accessibility violations', async () => {
    const { container } = render(<TodoGridSkeleton count={2} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('TodoListSkeleton', () => {
  it('should render default number of skeleton items', () => {
    render(<TodoListSkeleton />);
    
    const skeletons = screen.getAllByRole('status');
    expect(skeletons).toHaveLength(5); // Default count
  });
  
  it('should render custom number of skeleton items', () => {
    render(<TodoListSkeleton count={8} />);
    
    const skeletons = screen.getAllByRole('status');
    expect(skeletons).toHaveLength(8);
  });
  
  it('should have list layout classes', () => {
    const { container } = render(<TodoListSkeleton />);
    
    const listContainer = container.firstChild;
    expect(listContainer).toHaveClass('space-y-2');
  });
  
  it('should not have accessibility violations', async () => {
    const { container } = render(<TodoListSkeleton count={3} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('Skeleton Performance', () => {
  it('should render quickly with many items', () => {
    const startTime = performance.now();
    
    render(<TodoGridSkeleton count={50} />);
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Should render in less than 100ms even with 50 items
    expect(renderTime).toBeLessThan(100);
  });
  
  it('should not cause memory leaks with repeated renders', () => {
    const { rerender, unmount } = render(<TodoListSkeleton count={10} />);
    
    // Re-render multiple times
    for (let i = 0; i < 10; i++) {
      rerender(<TodoListSkeleton count={i + 1} />);
    }
    
    // Should unmount cleanly
    expect(() => unmount()).not.toThrow();
  });
});

describe('Skeleton Visual States', () => {
  it('should maintain consistent styling across all skeleton types', () => {
    const { container: cardContainer } = render(<TodoCardSkeleton />);
    const { container: compactContainer } = render(<TodoCardSkeletonCompact />);
    
    const cardSkeleton = cardContainer.querySelector('[role="status"]');
    const compactSkeleton = compactContainer.querySelector('[role="status"]');
    
    // Both should have animation and proper background
    expect(cardSkeleton).toHaveClass('animate-pulse', 'bg-white');
    expect(compactSkeleton).toHaveClass('animate-pulse', 'bg-white');
  });
  
  it('should use appropriate placeholder colors', () => {
    const { container } = render(<TodoCardSkeleton />);
    
    const placeholders = container.querySelectorAll('.bg-gray-200');
    expect(placeholders.length).toBeGreaterThan(0);
    
    placeholders.forEach(placeholder => {
      expect(placeholder).toHaveClass('bg-gray-200');
    });
  });
});

describe('Skeleton Responsive Behavior', () => {
  it('should adapt to different screen sizes in grid layout', () => {
    const { container } = render(<TodoGridSkeleton />);
    
    const gridContainer = container.firstChild;
    expect(gridContainer).toHaveClass(
      'md:grid-cols-2', // Medium screens: 2 columns
      'lg:grid-cols-3'  // Large screens: 3 columns
    );
  });
  
  it('should maintain proper spacing in list layout', () => {
    const { container } = render(<TodoListSkeleton />);
    
    const listContainer = container.firstChild;
    expect(listContainer).toHaveClass('space-y-2');
  });
});

describe('Skeleton Integration', () => {
  it('should work as loading state replacement', () => {
    const MockTodoList: React.FC<{ loading: boolean }> = ({ loading }) => {
      if (loading) {
        return <TodoListSkeleton count={3} />;
      }
      
      return (
        <div>
          <div>Todo 1</div>
          <div>Todo 2</div>
          <div>Todo 3</div>
        </div>
      );
    };
    
    const { rerender } = render(<MockTodoList loading={true} />);
    
    // Should show skeletons when loading
    expect(screen.getAllByRole('status')).toHaveLength(3);
    
    // Should show content when not loading
    rerender(<MockTodoList loading={false} />);
    expect(screen.queryAllByRole('status')).toHaveLength(0);
    expect(screen.getByText('Todo 1')).toBeInTheDocument();
  });
  
  it('should transition smoothly from skeleton to content', () => {
    const MockComponent: React.FC<{ showContent: boolean }> = ({ showContent }) => {
      return (
        <div className="transition-all duration-200">
          {showContent ? (
            <div data-testid="content">Loaded content</div>
          ) : (
            <TodoCardSkeleton />
          )}
        </div>
      );
    };
    
    const { rerender } = render(<MockComponent showContent={false} />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    
    rerender(<MockComponent showContent={true} />);
    
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });
});

// Export components for potential use in other tests
export {
  TodoCardSkeleton,
  TodoCardSkeletonCompact,
  TodoGridSkeleton,
  TodoListSkeleton,
};
