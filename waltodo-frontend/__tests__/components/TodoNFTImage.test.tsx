import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TodoNFTImage } from '@/components/TodoNFTImage';
import { useWalrusContent } from '@/lib/walrus-content-fetcher';

// Mock the dependencies
jest.mock('@/lib/walrus-content-fetcher');
jest.mock('@/lib/walrus-url-utils', () => ({
  isWalrusUrl: jest.fn((url: string) => url.startsWith('walrus://')),
  extractBlobId: jest.fn((url: string) => {
    if (url.startsWith('walrus://')) {
      return url.slice('walrus://'.length);
    }
    throw new Error('Invalid URL');
  }),
  generateHttpUrl: jest.fn((blobId: string) => `https://testnet.wal.app/blob/${blobId}`)
}));

jest.mock('@/lib/walrus-client', () => ({
  walrusClient: {
    getBlobUrl: jest.fn((blobId: string) => `https://aggregator-testnet.walrus.space/v1/${blobId}`)
  }
}));

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />;
  },
}));

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
});
window.IntersectionObserver = mockIntersectionObserver as any;

describe('TodoNFTImage', () => {
  const mockWalrusUrl = 'walrus://1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const mockHttpUrl = 'https://testnet.wal.app/blob/1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const mockBlobId = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  beforeEach(() => {
    jest.clearAllMocks();
    (useWalrusContent as jest.Mock).mockReturnValue({
      data: null,
      loading: false,
      error: null,
      progress: null,
      refetch: jest.fn()
    });
  });

  describe('Rendering', () => {
    it('renders with basic props', () => {
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Test NFT"
        />
      );

      const image = screen.getByRole('img');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('alt', 'Test NFT');
    });

    it('renders with different display modes', () => {
      const modes: Array<'thumbnail' | 'preview' | 'full'> = ['thumbnail', 'preview', 'full'];
      
      modes.forEach(mode => {
        const { container } = render(
          <TodoNFTImage
            url={mockWalrusUrl}
            alt={`Test ${mode}`}
            mode={mode}
          />
        );

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass(expect.stringContaining(mode === 'thumbnail' ? 'w-[150px]' : ''));
      });
    });

    it('applies custom className', () => {
      const { container } = render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Test NFT"
          className="custom-class"
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });
  });

  describe('URL Handling', () => {
    it('handles walrus:// URLs', () => {
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Walrus URL Test"
        />
      );

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', expect.stringContaining('testnet.wal.app'));
    });

    it('handles HTTP URLs directly', () => {
      render(
        <TodoNFTImage
          url={mockHttpUrl}
          alt="HTTP URL Test"
        />
      );

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', mockHttpUrl);
    });

    it('handles direct blob IDs', () => {
      render(
        <TodoNFTImage
          url={mockBlobId}
          alt="Blob ID Test"
        />
      );

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', expect.stringContaining('walrus.space'));
    });

    it('shows error state for invalid URLs', () => {
      render(
        <TodoNFTImage
          url="invalid-url"
          alt="Invalid URL Test"
        />
      );

      expect(screen.getByText('Failed to load image')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading skeleton when showSkeleton is true', () => {
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Loading Test"
          showSkeleton={true}
          lazy={false}
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('does not show skeleton when showSkeleton is false', () => {
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="No Skeleton Test"
          showSkeleton={false}
        />
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('Interactivity', () => {
    it('calls onClick handler when clicked', () => {
      const handleClick = jest.fn();
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Click Test"
          onClick={handleClick}
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('expands image when clicked if expandable', () => {
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Expandable Test"
          expandable={true}
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText('Expanded image view')).toBeInTheDocument();
    });

    it('does not expand when expandable is false', () => {
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Non-expandable Test"
          expandable={false}
        />
      );

      const image = screen.getByRole('img');
      fireEvent.click(image);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes modal when close button is clicked', () => {
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Modal Test"
          expandable={true}
        />
      );

      // Open modal
      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close modal
      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes modal on Escape key', () => {
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Escape Test"
          expandable={true}
        />
      );

      // Open modal
      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Accessibility Test"
          ariaLabel="Custom ARIA label"
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Custom ARIA label');
    });

    it('adds expandable hint to ARIA label when expandable', () => {
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Expandable ARIA Test"
          expandable={true}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', expect.stringContaining('Click to expand'));
    });

    it('supports keyboard navigation', () => {
      const handleClick = jest.fn();
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Keyboard Test"
          onClick={handleClick}
        />
      );

      const button = screen.getByRole('button');
      
      // Test Enter key
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);

      // Test Space key
      fireEvent.keyDown(button, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('Lazy Loading', () => {
    it('uses IntersectionObserver when lazy is true', () => {
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Lazy Loading Test"
          lazy={true}
        />
      );

      expect(mockIntersectionObserver).toHaveBeenCalled();
    });

    it('does not use IntersectionObserver when lazy is false', () => {
      mockIntersectionObserver.mockClear();
      
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Eager Loading Test"
          lazy={false}
        />
      );

      expect(mockIntersectionObserver).not.toHaveBeenCalled();
    });

    it('becomes visible when intersecting', () => {
      let observerCallback: IntersectionObserverCallback | null = null;
      
      mockIntersectionObserver.mockImplementation((callback) => {
        observerCallback = callback;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn()
        };
      });

      const { container } = render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Intersection Test"
          lazy={true}
        />
      );

      // Initially shows skeleton
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Simulate intersection
      if (observerCallback) {
        observerCallback([
          {
            isIntersecting: true,
            target: container.firstChild as Element,
            intersectionRatio: 1,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: {} as DOMRectReadOnly,
            boundingClientRect: {} as DOMRectReadOnly,
            time: 0
          }
        ], {} as IntersectionObserver);
      }

      // Should now show image
      waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error state on image load error', () => {
      render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Error Test"
        />
      );

      const image = screen.getByRole('img');
      fireEvent.error(image);

      expect(screen.getByText('Failed to load image')).toBeInTheDocument();
    });

    it('uses fallback URL when provided', () => {
      const fallbackUrl = '/fallback.png';
      render(
        <TodoNFTImage
          url="invalid-url"
          alt="Fallback Test"
          fallbackUrl={fallbackUrl}
        />
      );

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', fallbackUrl);
    });
  });

  describe('Hover Effects', () => {
    it('applies hover classes when enableHover is true', () => {
      const { container } = render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="Hover Test"
          enableHover={true}
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('hover:scale-105');
    });

    it('does not apply hover classes when enableHover is false', () => {
      const { container } = render(
        <TodoNFTImage
          url={mockWalrusUrl}
          alt="No Hover Test"
          enableHover={false}
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).not.toHaveClass('hover:scale-105');
    });
  });
});