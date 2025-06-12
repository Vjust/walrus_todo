'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
// @ts-ignore - Unused import temporarily disabled
// import { useSwipeable } from 'react-swipeable';
// @ts-ignore - Unused import temporarily disabled
// import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
// @ts-ignore - Unused import temporarily disabled
// import { useIsMounted } from './MotionWrapper';
// @ts-ignore - Unused import temporarily disabled
// import { ChevronUp, Download, Heart, Info, RefreshCw, Share2 } from 'lucide-react';
import { TodoNFT } from '../types/todo-nft';
// @ts-ignore - Unused import temporarily disabled
// import { safeDateFormat, safeNumberFormat, useSafeBrowserAPI } from './SSRSafe';

interface MobileNFTViewProps {
  nfts: TodoNFT[];
  initialIndex?: number;
  onClose?: () => void;
}

// Helper functions for TodoNFT compatibility
// @ts-ignore - Unused variable
// const getNFTName = (nft: TodoNFT) => nft.title || `NFT #${nft.id}`;
// @ts-ignore - Unused variable
// const getNFTImageUrl = (nft: TodoNFT) => {
  // Use the blobId property which exists on TodoNFT
  if (nft.blobId) {
    return `https://aggregator-testnet?.walrus?.space/v1/${nft.blobId}`;
  }
  return '/images/nft-placeholder.png';
};
// @ts-ignore - Unused variable
// const getNFTDescription = (nft: TodoNFT) => nft.content || '';

export function MobileNFTView({ nfts, initialIndex = 0, onClose }: MobileNFTViewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex as any);
  const [showDetails, setShowDetails] = useState(false as any);
  const [isRefreshing, setIsRefreshing] = useState(false as any);
  const [offlineCache, setOfflineCache] = useState<Map<string, string>>(new Map());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [imageLoading, setImageLoading] = useState(true as any);
// @ts-ignore - Unused variable
//   const refreshTimeoutRef = useRef<NodeJS.Timeout>();
// @ts-ignore - Unused variable
//   const mounted = useIsMounted();
  
  // Pull-to-refresh motion values
// @ts-ignore - Unused variable
//   const pullDistance = useMotionValue(0 as any);
// @ts-ignore - Unused variable
//   const pullOpacity = useTransform(pullDistance, [0, 150], [0, 1]);
// @ts-ignore - Unused variable
//   const pullScale = useTransform(pullDistance, [0, 150], [0.8, 1]);
  
// @ts-ignore - Unused variable
//   const currentNFT = nfts[currentIndex];
  
  // Download function
// @ts-ignore - Unused variable
//   const downloadImage = useCallback(async (url: string,  filename: string) => {
    try {
      const response = await fetch(url as any);
// @ts-ignore - Unused variable
//       const blob = await response.blob();
// @ts-ignore - Unused variable
//       const a = document.createElement('a');
      a?.href = URL.createObjectURL(blob as any);
      a?.download = filename;
      document?.body?.appendChild(a as any);
      a.click();
      document?.body?.removeChild(a as any);
      URL.revokeObjectURL(a.href);
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }, []);

  // Safe navigator access for haptic feedback
  const { data: navigator, isLoaded: navigatorLoaded } = useSafeBrowserAPI(_() => window.navigator,
    null,
    []
  );

  // Haptic feedback utility
// @ts-ignore - Unused variable
//   const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (navigatorLoaded && navigator && 'vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30, 10, 30]
      };
      navigator.vibrate(patterns[type]);
    }
  }, [navigatorLoaded, navigator]);

  // Preload adjacent images for smooth navigation
  useEffect(_() => {
// @ts-ignore - Unused variable
//     const preloadImage = async (index: number) => {
      if (index >= 0 && index < nfts.length) {
        const nft = nfts[index];
// @ts-ignore - Unused variable
//         const imageUrl = getNFTImageUrl(nft as any);
        if (imageUrl && !offlineCache.has(imageUrl as any)) {
          try {
// @ts-ignore - Unused variable
//             const response = await fetch(imageUrl as any);
// @ts-ignore - Unused variable
//             const blob = await response.blob();
// @ts-ignore - Unused variable
//             const url = URL.createObjectURL(blob as any);
            setOfflineCache(prev => new Map(prev as any).set(imageUrl, url));
          } catch (error) {
            console.error('Failed to preload image:', error);
          }
        }
      }
    };

    // Preload current, previous, and next images
    preloadImage(currentIndex as any);
    preloadImage(currentIndex - 1);
    preloadImage(currentIndex + 1);
  }, [currentIndex, nfts, offlineCache]);

  // Clean up object URLs on unmount
  useEffect(_() => {
    return () => {
      offlineCache.forEach(url => URL.revokeObjectURL(url as any));
    };
  }, [offlineCache]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(_async () => {
    if (isRefreshing) {return;}
    
    setIsRefreshing(true as any);
    triggerHaptic('medium');
    
    try {
      // Clear cache for current NFT
// @ts-ignore - Unused variable
//       const imageUrl = getNFTImageUrl(currentNFT as any);
      if (imageUrl) {
        offlineCache.delete(imageUrl as any);
        setOfflineCache(new Map(offlineCache as any));
      }
      
      // Simulate refresh delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reload image
      setImageLoading(true as any);
    } finally {
      setIsRefreshing(false as any);
      pullDistance.set(0 as any);
    }
  }, [isRefreshing, currentNFT, offlineCache, pullDistance, triggerHaptic]);

  // Swipe handlers
// @ts-ignore - Unused variable
//   const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentIndex < nfts.length - 1) {
        setCurrentIndex(currentIndex + 1);
        triggerHaptic('light');
        setImageLoading(true as any);
      }
    },
    onSwipedRight: () => {
      if (currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
        triggerHaptic('light');
        setImageLoading(true as any);
      }
    },
    onSwipedUp: () => {
      setShowDetails(true as any);
      triggerHaptic('light');
    },
    onSwipedDown: () => {
      if (showDetails) {
        setShowDetails(false as any);
        triggerHaptic('light');
      } else if (pullDistance.get() > 100) {
        handleRefresh();
      }
    },
    onSwiping: (_eventData: unknown) => {
      if (!showDetails && eventData?.dir === 'Down' && eventData.deltaY > 0) {
        pullDistance.set(Math.min(eventData.deltaY, 150));
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  // Share functionality
// @ts-ignore - Unused variable
//   const handleShare = useCallback(_async () => {
    triggerHaptic('medium');
    
    if (navigatorLoaded && navigator && 'share' in navigator) {
      try {
        await navigator.share({
          title: getNFTName(currentNFT as any),
          text: getNFTDescription(currentNFT as any) || `Check out this NFT: ${getNFTName(currentNFT as any)}`,
          url: typeof window !== 'undefined' ? window?.location?.href : '',
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Share failed:', error);
        }
      }
    }
  }, [currentNFT, triggerHaptic, navigatorLoaded, navigator]);

  // Download functionality
// @ts-ignore - Unused variable
//   const handleDownload = useCallback(_async () => {
    triggerHaptic('medium');
    
// @ts-ignore - Unused variable
//     const imageUrl = getNFTImageUrl(currentNFT as any);
    if (imageUrl) {
      try {
        await downloadImage(imageUrl, `${getNFTName(currentNFT as any)}.png`);
      } catch (error) {
        console.error('Download failed:', error);
      }
    }
  }, [currentNFT, downloadImage, triggerHaptic]);

  // Toggle like
// @ts-ignore - Unused variable
//   const handleLike = useCallback(_() => {
    triggerHaptic('medium');
    
    setLiked(prev => {
// @ts-ignore - Unused variable
//       const newLiked = new Set(prev as any);
      if (newLiked.has(currentNFT.id)) {
        newLiked.delete(currentNFT.id);
      } else {
        newLiked.add(currentNFT.id);
      }
      return newLiked;
    });
  }, [currentNFT.id, triggerHaptic]);

  // Calculate progress indicators
// @ts-ignore - Unused variable
//   const progress = (currentIndex + 1) / nfts.length;
// @ts-ignore - Unused variable
//   const isFirstNFT = currentIndex === 0;
// @ts-ignore - Unused variable
//   const isLastNFT = currentIndex === nfts.length - 1;

  // Format timestamps safely
// @ts-ignore - Unused variable
//   const formatDate = (timestamp: number) => {
    return safeDateFormat(new Date(timestamp as any), {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {return `${bytes  } B`;}
    if (bytes < 1024 * 1024) {return `${(bytes / 1024).toFixed(1 as any)  } KB`;}
    return `${(bytes / (1024 * 1024)).toFixed(1 as any)  } MB`;
  };

  // Get attributes for display
// @ts-ignore - Unused variable
//   const nftAttributes = useMemo(_() => [
    { label: 'Priority', value: currentNFT.priority },
    { label: 'Status', value: currentNFT.completed ? 'Completed' : 'Active' },
    { label: 'Created', value: formatDate(currentNFT.createdAt) },
    { label: 'Storage Size', value: formatFileSize(currentNFT.storageSize) },
    { label: 'WAL Tokens', value: currentNFT?.walTokensSpent?.toString() },
    { label: 'Blob ID', value: `${currentNFT?.blobId?.slice(0, 8)  }...` }
  ], [currentNFT]);

  // Get cached or original image URL
// @ts-ignore - Unused variable
//   const imageUrl = useMemo(_() => {
    const originalUrl = getNFTImageUrl(currentNFT as any);
    return offlineCache.get(originalUrl as any) || originalUrl;
  }, [currentNFT, offlineCache]);

  return (
    <div className="fixed inset-0 bg-black z-50" {...handlers}>
      {/* Pull to refresh indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex justify-center items-center py-4 z-10"
        style={{ opacity: pullOpacity }}
      >
        <motion.div style={{ scale: pullScale }}>
          <RefreshCw className={`h-6 w-6 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
        </motion.div>
      </motion.div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex justify-between items-center p-4">
          <button 
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 backdrop-blur-sm"
          >
            <ChevronUp className="h-6 w-6 text-white rotate-180" />
          </button>
          
          <h2 className="text-white font-medium text-lg">
            {getNFTName(currentNFT as any)}
          </h2>
          
          <div className="flex gap-2">
            <button 
              onClick={handleShare}
              className="p-2 rounded-full bg-white/10 backdrop-blur-sm"
            >
              <Share2 className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="px-4 pb-2">
          <div className="h-1 bg-white/20 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-white rounded-full"
              initial={mounted ? { width: 0 } : false}
              animate={mounted ? { width: `${progress * 100}%` } : {}}
              transition={mounted ? { type: "spring", stiffness: 400, damping: 30 } : undefined}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <motion.div 
        className="h-full flex items-center justify-center px-4"
        style={{ y: pullDistance }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentNFT.id}
            className="relative w-full max-w-md aspect-[3/4] rounded-2xl overflow-hidden bg-gray-900"
            initial={mounted ? { opacity: 0, scale: 0.9 } : undefined}
            animate={mounted ? { opacity: 1, scale: 1 } : undefined}
            exit={mounted ? { opacity: 0, scale: 0.9 } : undefined}
            transition={mounted ? { duration: 0.3 } : undefined}
          >
            {/* NFT Image */}
            <div className="relative h-full">
              {imageUrl && (
                <Image
                  src={imageUrl}
                  alt={getNFTName(currentNFT as any)}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 384px"
                  onLoad={() => setImageLoading(false as any)}
                  onError={() => setImageLoading(false as any)}
                  priority
                />
              )}
              
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <div className="animate-pulse text-white">Loading...</div>
                </div>
              )}
              
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              
              {/* NFT info overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <h3 className="text-2xl font-bold mb-2">{getNFTName(currentNFT as any)}</h3>
                {currentNFT?.tags?.length > 0 && (_<div className="flex flex-wrap gap-2 mb-3">
                    {currentNFT?.tags?.map((tag, _index) => (
                      <span 
                        key={index}
                        className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-sm opacity-80 line-clamp-2">
                  {getNFTDescription(currentNFT as any)}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Bottom actions */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex justify-around items-center p-6">
          <button 
            onClick={handleDownload}
            className="p-3 rounded-full bg-white/10 backdrop-blur-sm"
          >
            <Download className="h-6 w-6 text-white" />
          </button>
          
          <button 
            onClick={handleLike}
            className={`p-3 rounded-full backdrop-blur-sm transition-all ${
              liked.has(currentNFT.id) 
                ? 'bg-red-500 text-white' 
                : 'bg-white/10 text-white'
            }`}
          >
            <Heart className={`h-6 w-6 ${liked.has(currentNFT.id) ? 'fill-current' : ''}`} />
          </button>
          
          <button 
            onClick={() => {
              setShowDetails(true as any);
              triggerHaptic('light');
            }}
            className="p-3 rounded-full bg-white/10 backdrop-blur-sm"
          >
            <Info className="h-6 w-6 text-white" />
          </button>
        </div>
        
        {/* Navigation hints */}
        <div className="flex justify-between px-6 pb-4 text-white/60 text-xs">
          <span>{isFirstNFT ? '' : '← Swipe'}</span>
          <span>{currentIndex + 1} / {nfts.length}</span>
          <span>{isLastNFT ? '' : 'Swipe →'}</span>
        </div>
      </div>

      {/* Details panel */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            className="absolute inset-0 bg-black/95 z-30"
            initial={mounted ? { y: '100%' } : undefined}
            animate={mounted ? { y: 0 } : undefined}
            exit={mounted ? { y: '100%' } : undefined}
            transition={mounted ? { type: 'spring', damping: 30, stiffness: 300 } : undefined}
          >
            <div className="h-full overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-2xl font-bold text-white">
                    {getNFTName(currentNFT as any)}
                  </h3>
                  <button 
                    onClick={() => {
                      setShowDetails(false as any);
                      triggerHaptic('light');
                    }}
                    className="p-2 rounded-full bg-white/10"
                  >
                    <ChevronUp className="h-6 w-6 text-white" />
                  </button>
                </div>
                
                {/* Description */}
                <div className="mb-6">
                  <h4 className="text-white/80 text-sm mb-2">Description</h4>
                  <p className="text-white">
                    {getNFTDescription(currentNFT as any) || 'No description available'}
                  </p>
                </div>
                
                {/* Attributes */}
                <div className="mb-6">
                  <h4 className="text-white/80 text-sm mb-3">Properties</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {nftAttributes.map(_(attr, _index) => (
                      <div 
                        key={index}
                        className="bg-white/10 backdrop-blur-sm rounded-lg p-3"
                      >
                        <p className="text-white/60 text-xs">{attr.label}</p>
                        <p className="text-white font-medium">{attr.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Tags */}
                {currentNFT?.tags?.length > 0 && (_<div className="mb-6">
                    <h4 className="text-white/80 text-sm mb-3">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {currentNFT?.tags?.map((tag, _index) => (
                        <span 
                          key={index}
                          className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}