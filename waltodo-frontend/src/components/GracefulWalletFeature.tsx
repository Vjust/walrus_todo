'use client';

/**
 * GracefulWalletFeature - Wrapper for wallet-dependent features with graceful degradation
 * 
 * Provides consistent error handling, loading states, and fallbacks for any
 * component that requires wallet functionality
 */

import React from 'react';
import { useClientSafeWallet } from '@/hooks/useClientSafeWallet';
import WalletErrorBoundary from './WalletErrorBoundary';
import { ConnectWalletPrompt, NoWalletFallback } from './NoWalletFallback';
import { WalletButtonSkeleton } from './WalletSkeleton';

interface GracefulWalletFeatureProps {
  children: React.ReactNode;
  requireConnection?: boolean;
  loadingVariant?: 'button' | 'card' | 'status' | 'address';
  fallbackVariant?: 'full' | 'inline' | 'minimal';
  showConnectPrompt?: boolean;
  showBrowseMode?: boolean;
  enableBrowseMode?: boolean;
  browseModeContent?: React.ReactNode;
  className?: string;
  onBrowseMode?: () => void;
}

export function GracefulWalletFeature({
  children,
  requireConnection = true,
  loadingVariant = 'card',
  fallbackVariant = 'inline',
  showConnectPrompt = true,
  showBrowseMode = true,
  enableBrowseMode = false,
  browseModeContent,
  className = '',
  onBrowseMode,
}: GracefulWalletFeatureProps) {
  const [browseMode, setBrowseMode] = React.useState(enableBrowseMode);
  
  const handleBrowseMode = () => {
    setBrowseMode(true);
    if (onBrowseMode) {
      onBrowseMode();
    }
  };

  // If browse mode is enabled and active, show browse content
  if (browseMode && browseModeContent) {
    return (
      <div className={className}>
        {browseModeContent}
      </div>
    );
  }

  return (
    <WalletErrorBoundary
      fallback={
        <NoWalletFallback 
          variant={fallbackVariant}
          showBrowseMode={showBrowseMode}
          onBrowseMode={handleBrowseMode}
          className={className}
        />
      }
      className={className}
    >
      <WalletFeatureContent
        requireConnection={requireConnection}
        loadingVariant={loadingVariant}
        fallbackVariant={fallbackVariant}
        showConnectPrompt={showConnectPrompt}
        showBrowseMode={showBrowseMode}
        onBrowseMode={handleBrowseMode}
        className={className}
      >
        {children}
      </WalletFeatureContent>
    </WalletErrorBoundary>
  );
}

function WalletFeatureContent({
  children,
  requireConnection,
  loadingVariant,
  fallbackVariant,
  showConnectPrompt,
  showBrowseMode,
  onBrowseMode,
  className,
}: Omit<GracefulWalletFeatureProps, 'browseModeContent' | 'enableBrowseMode'>) {
  const wallet = useClientSafeWallet();

  // Loading state during wallet initialization
  if (!wallet || wallet.isLoading) {
    return <WalletButtonSkeleton size="md" className={className} />;
  }

  // Handle wallet errors
  if (wallet.error) {
    return (
      <NoWalletFallback 
        variant={fallbackVariant}
        title="Wallet Error"
        description={`Unable to connect to wallet: ${wallet.error}`}
        showBrowseMode={showBrowseMode}
        onBrowseMode={onBrowseMode}
        className={className}
      />
    );
  }

  // If connection is required but wallet isn't connected
  if (requireConnection && !wallet.connected) {
    if (showConnectPrompt) {
      return (
        <ConnectWalletPrompt 
          className={className}
        />
      );
    } else {
      return (
        <NoWalletFallback 
          variant={fallbackVariant}
          title="Wallet Connection Required"
          description="Please connect your Sui wallet to access this feature"
          showBrowseMode={showBrowseMode}
          onBrowseMode={onBrowseMode}
          className={className}
        />
      );
    }
  }

  // Wallet is available and connected (or connection not required)
  return <>{children}</>;
}

// Specialized wrapper for different use cases
export function WalletRequired({ 
  children, 
  className = '',
  fallbackVariant = 'inline' as const,
}: { 
  children: React.ReactNode; 
  className?: string;
  fallbackVariant?: 'full' | 'inline' | 'minimal';
}) {
  return (
    <GracefulWalletFeature
      requireConnection
      loadingVariant="card"
      fallbackVariant={fallbackVariant}
      className={className}
    >
      {children}
    </GracefulWalletFeature>
  );
}

export function WalletOptional({ 
  children, 
  browseModeContent,
  className = '',
}: { 
  children: React.ReactNode; 
  browseModeContent?: React.ReactNode;
  className?: string;
}) {
  return (
    <GracefulWalletFeature
      requireConnection={false}
      loadingVariant="card"
      fallbackVariant="minimal"
      showBrowseMode={Boolean(browseModeContent)}
      browseModeContent={browseModeContent}
      enableBrowseMode={false}
      className={className}
    >
      {children}
    </GracefulWalletFeature>
  );
}

export function WalletButton({ 
  children, 
  className = '',
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <GracefulWalletFeature
      requireConnection={false}
      loadingVariant="button"
      fallbackVariant="minimal"
      showConnectPrompt
      className={className}
    >
      {children}
    </GracefulWalletFeature>
  );
}

// Hook for conditional wallet feature rendering
export function useWalletFeature(requireConnection = true) {
  const wallet = useClientSafeWallet();
  
  const isAvailable = React.useMemo(() => {
    if (!wallet || wallet.isLoading) {return false;}
    if (wallet.error) {return false;}
    if (requireConnection && !wallet.connected) {return false;}
    return true;
  }, [wallet, requireConnection]);

  const shouldShowFallback = React.useMemo(() => {
    if (!wallet || wallet.isLoading) {return false;}
    if (wallet.error) {return true;}
    if (requireConnection && !wallet.connected) {return true;}
    return false;
  }, [wallet, requireConnection]);

  return {
    isAvailable,
    shouldShowFallback,
    isLoading: !wallet || wallet.isLoading,
    wallet,
  };
}

export default GracefulWalletFeature;