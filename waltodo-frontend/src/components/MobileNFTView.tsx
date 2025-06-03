'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useSwipeable } from 'react-swipeable';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import { useIsMounted } from './MotionWrapper';
import { ChevronUp, Download, Heart, Info, RefreshCw, Share2 } from 'lucide-react';
import { TodoNFT } from '../types/todo-nft';
import { safeDateFormat, safeNumberFormat, useSafeBrowserAPI } from './SSRSafe';

interface MobileNFTViewProps {
  nfts: TodoNFT[];
  initialIndex?: number;
  onClose?: () => void;
}

// Helper functions for TodoNFT compatibility
const getNFTName = (nft: TodoNFT) => nft.title || `NFT #${nft.id}`;
const getNFTImageUrl = (nft: TodoNFT) => {
  // Use the blobId property which exists on TodoNFT
  if (nft.blobId) {
    return `https://aggregator-testnet.walrus.space/v1/${nft.blobId}`;
  }
  return '/images/nft-placeholder.png';
};
const getNFTDescription = (nft: TodoNFT) => nft.content || '';

export function MobileNFTView({ nfts, initialIndex = 0, onClose }: MobileNFTViewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showDetails, setShowDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [offlineCache, setOfflineCache] = useState<Map<string, string>>(new Map());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [imageLoading, setImageLoading] = useState(true);
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const mounted = useIsMounted();
  
  // Pull-to-refresh motion values
  const pullDistance = useMotionValue(0);
  const pullOpacity = useTransform(pullDistance, [0, 150], [0, 1]);
  const pullScale = useTransform(pullDistance, [0, 150], [0.8, 1]);
  
  const currentNFT = nfts[currentIndex];
  
  // Download function
  const downloadImage = useCallback(async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }, []);

  // Safe navigator access for haptic feedback
  const { data: navigator, isLoaded: navigatorLoaded } = useSafeBrowserAPI(
    () => window.navigator,
    null,
    []
  );

  // Haptic feedback utility
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
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
  useEffect(() => {
    const preloadImage = async (index: number) => {
      if (index >= 0 && index < nfts.length) {
        const nft = nfts[index];
        const imageUrl = getNFTImageUrl(nft);
        if (imageUrl && !offlineCache.has(imageUrl)) {
          try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setOfflineCache(prev => new Map(prev).set(imageUrl, url));
          } catch (error) {
            console.error('Failed to preload image:', error);
          }
        }
      }
    };

    // Preload current, previous, and next images
    preloadImage(currentIndex);
    preloadImage(currentIndex - 1);
    preloadImage(currentIndex + 1);
  }, [currentIndex, nfts, offlineCache]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      offlineCache.forEach(url => URL.revokeObjectURL(url));
    };
  }, [offlineCache]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {return;}
    
    setIsRefreshing(true);
    triggerHaptic('medium');
    
    try {
      // Clear cache for current NFT
      const imageUrl = getNFTImageUrl(currentNFT);
      if (imageUrl) {
        offlineCache.delete(imageUrl);
        setOfflineCache(new Map(offlineCache));
      }
      
      // Simulate refresh delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reload image
      setImageLoading(true);
    } finally {
      setIsRefreshing(false);
      pullDistance.set(0);
    }
  }, [isRefreshing, currentNFT, offlineCache, pullDistance, triggerHaptic]);

  // Swipe handlers
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentIndex < nfts.length - 1) {
        setCurrentIndex(currentIndex + 1);
        triggerHaptic('light');
        setImageLoading(true);
      }
    },
    onSwipedRight: () => {
      if (currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
        triggerHaptic('light');
        setImageLoading(true);
      }
    },
    onSwipedUp: () => {
      setShowDetails(true);
      triggerHaptic('light');
    },
    onSwipedDown: () => {
      if (showDetails) {
        setShowDetails(false);
        triggerHaptic('light');
      } else if (pullDistance.get() > 100) {
        handleRefresh();
      }
    },
    onSwiping: (eventData) => {
      if (!showDetails && eventData.dir === 'Down' && eventData.deltaY > 0) {
        pullDistance.set(Math.min(eventData.deltaY, 150));
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  // Share functionality
  const handleShare = useCallback(async () => {
    triggerHaptic('medium');
    
    if (navigatorLoaded && navigator && 'share' in navigator) {
      try {
        await navigator.share({
          title: getNFTName(currentNFT),
          text: getNFTDescription(currentNFT) || `Check out this NFT: ${getNFTName(currentNFT)}`,
          url: typeof window !== 'undefined' ? window.location.href : '',
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Share failed:', error);
        }
      }
    }
  }, [currentNFT, triggerHaptic, navigatorLoaded, navigator]);

  // Download functionality
  const handleDownload = useCallback(async () => {
    triggerHaptic('medium');
    
    const imageUrl = getNFTImageUrl(currentNFT);
    if (imageUrl) {
      try {
        await downloadImage(imageUrl, `${getNFTName(currentNFT)}.png`);
      } catch (error) {
        console.error('Download failed:', error);
      }
    }
  }, [currentNFT, downloadImage, triggerHaptic]);

  // Toggle like
  const handleLike = useCallback(() => {
    triggerHaptic('medium');
    
    setLiked(prev => {
      const newLiked = new Set(prev);
      if (newLiked.has(currentNFT.id)) {
        newLiked.delete(currentNFT.id);
      } else {
        newLiked.add(currentNFT.id);
      }
      return newLiked;
    });
  }, [currentNFT.id, triggerHaptic]);

  // Calculate progress indicators
  const progress = (currentIndex + 1) / nfts.length;
  const isFirstNFT = currentIndex === 0;
  const isLastNFT = currentIndex === nfts.length - 1;

  // Format timestamps safely
  const formatDate = (timestamp: number) => {
    return safeDateFormat(new Date(timestamp), {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {return `${bytes  } B`;}
    if (bytes < 1024 * 1024) {return `${(bytes / 1024).toFixed(1)  } KB`;}
    return `${(bytes / (1024 * 1024)).toFixed(1)  } MB`;
  };

  // Get attributes for display
  const nftAttributes = useMemo(() => [
    { label: 'Priority', value: currentNFT.priority },
    { label: 'Status', value: currentNFT.completed ? 'Completed' : 'Active' },
    { label: 'Created', value: formatDate(currentNFT.createdAt) },
    { label: 'Storage Size', value: formatFileSize(currentNFT.storageSize) },
    { label: 'WAL Tokens', value: currentNFT.walTokensSpent.toString() },
    { label: 'Blob ID', value: `${currentNFT.blobId.slice(0, 8)  }...` }
  ], [currentNFT]);

  // Get cached or original image URL
  const imageUrl = useMemo(() => {
    const originalUrl = getNFTImageUrl(currentNFT);
    return offlineCache.get(originalUrl) || originalUrl;
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
            {getNFTName(currentNFT)}
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
                  alt={getNFTName(currentNFT)}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 384px"
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
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
                <h3 className="text-2xl font-bold mb-2">{getNFTName(currentNFT)}</h3>
                {currentNFT.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {currentNFT.tags.map((tag, index) => (
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
                  {getNFTDescription(currentNFT)}
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
              setShowDetails(true);
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
                    {getNFTName(currentNFT)}
                  </h3>
                  <button 
                    onClick={() => {
                      setShowDetails(false);
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
                    {getNFTDescription(currentNFT) || 'No description available'}
                  </p>
                </div>
                
                {/* Attributes */}
                <div className="mb-6">
                  <h4 className="text-white/80 text-sm mb-3">Properties</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {nftAttributes.map((attr, index) => (
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
                {currentNFT.tags.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-white/80 text-sm mb-3">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {currentNFT.tags.map((tag, index) => (
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