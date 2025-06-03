'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletContext } from '@/contexts/WalletContext';
import toast from 'react-hot-toast';

export function useApiErrorHandler() {
  const router = useRouter();
  const walletContext = useWalletContext();

  useEffect(() => {
    if (typeof window === 'undefined') {return;}

    const handleApiError = async (error: any) => {
      console.error('[useApiErrorHandler] API Error:', error);

      // Check if it's an authentication error
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        toast.error('Authentication failed. Please reconnect your wallet.', {
          duration: 5000,
          icon: '🔒',
        });
        
        // Optionally disconnect wallet to force re-authentication
        if (walletContext?.connected) {
          // Give user a chance to see the message before disconnecting
          setTimeout(() => {
            walletContext.disconnect();
          }, 2000);
        }
      } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        toast.error('Access denied. You don\'t have permission for this action.', {
          duration: 5000,
          icon: '⛔',
        });
      } else if (error.message?.includes('Network') || error.message?.includes('fetch')) {
        toast.error('Network error. Please check your connection.', {
          duration: 5000,
          icon: '📡',
        });
      }
    };

    // Set up global error handler for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes('Request failed')) {
        handleApiError(event.reason);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [walletContext, router]);

  // Return a function that components can use to handle errors
  return {
    handleApiError: (error: any) => {
      console.error('[API Error]', error);
      
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        toast.error('Please connect your wallet to continue', {
          duration: 5000,
          icon: '🔐',
        });
        return true; // Handled
      }
      
      return false; // Not handled
    }
  };
}