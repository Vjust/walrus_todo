'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Share2, Download, Heart, Info, ChevronUp, RefreshCw } from 'lucide-react';
import { TodoNFT } from '../types/todo-nft';
import { useWalrusStorage } from '../hooks/useWalrusStorage';

interface MobileNFTViewProps {
  nfts: TodoNFT[];
  initialIndex?: number;
  onClose?: () => void;
}

export function MobileNFTView({ nfts, initialIndex = 0, onClose }: MobileNFTViewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showDetails, setShowDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [offlineCache, setOfflineCache] = useState<Map<string, string>>(new Map());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [imageLoading, setImageLoading] = useState(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pullDistance = useMotionValue(0);
  const pullOpacity = useTransform(pullDistance, [0, 150], [0, 1]);
  const pullScale = useTransform(pullDistance, [0, 150], [0.8, 1]);
  
  const { downloadImage } = useWalrusStorage();
  const currentNFT = nfts[currentIndex];

  // Haptic feedback utility
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30, 10, 30]
      };
      navigator.vibrate(patterns[type]);
    }
  }, []);

  // Preload adjacent images for smooth navigation
  useEffect(() => {
    const preloadImage = async (index: number) => {
      if (index >= 0 && index < nfts.length) {
        const nft = nfts[index];
        if (nft.imageUrl && !offlineCache.has(nft.imageUrl)) {
          try {
            const response = await fetch(nft.imageUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setOfflineCache(prev => new Map(prev).set(nft.imageUrl!, url));
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

  // Battery optimization: reduce animations when battery is low
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const checkBattery = async () => {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        setReducedMotion(battery.level < 0.2);
        
        battery.addEventListener('levelchange', () => {
          setReducedMotion(battery.level < 0.2);
        });
      }
    };
    checkBattery();
  }, []);

  // Pull-to-refresh handler
  const handlePullToRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    triggerHaptic('medium');
    
    try {
      // Simulate refresh - in real app, refetch NFT data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clear cache and reload current image
      if (currentNFT.imageUrl) {
        offlineCache.delete(currentNFT.imageUrl);
        setImageLoading(true);
      }
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
      } else if (onClose) {
        onClose();
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 10,
    preventScrollOnSwipe: true,
  });

  // Native share functionality
  const handleShare = useCallback(async () => {
    triggerHaptic('medium');
    
    if (navigator.share && currentNFT) {
      try {
        await navigator.share({
          title: currentNFT.name,
          text: currentNFT.description || `Check out this NFT: ${currentNFT.name}`,
          url: window.location.href,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Share failed:', error);
        }
      }
    }
  }, [currentNFT, triggerHaptic]);

  // Download for offline viewing
  const handleDownload = useCallback(async () => {
    triggerHaptic('medium');
    
    if (currentNFT.imageUrl) {
      try {
        await downloadImage(currentNFT.imageUrl, `${currentNFT.name}.png`);
      } catch (error) {
        console.error('Download failed:', error);
      }
    }
  }, [currentNFT, downloadImage, triggerHaptic]);

  // Toggle like
  const handleLike = useCallback(() => {
    triggerHaptic('medium');
    
    const newLiked = new Set(liked);
    if (liked.has(currentNFT.id)) {
      newLiked.delete(currentNFT.id);
    } else {
      newLiked.add(currentNFT.id);
    }
    setLiked(newLiked);
    
    // Save to localStorage for offline persistence
    localStorage.setItem('liked-nfts', JSON.stringify([...newLiked]));
  }, [currentNFT, liked, triggerHaptic]);

  // Load liked state from localStorage
  useEffect(() => {
    const savedLikes = localStorage.getItem('liked-nfts');
    if (savedLikes) {
      setLiked(new Set(JSON.parse(savedLikes)));
    }
  }, []);

  // Pull-to-refresh touch handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const startY = touch.clientY;
    
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const deltaY = touch.clientY - startY;
      
      if (deltaY > 0 && containerRef.current?.scrollTop === 0) {
        pullDistance.set(Math.min(deltaY, 150));
        
        if (deltaY > 100 && !isRefreshing) {
          handlePullToRefresh();
        }
      }
    };
    
    const handleTouchEnd = () => {
      if (!isRefreshing) {
        pullDistance.set(0);
      }
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
  }, [pullDistance, isRefreshing, handlePullToRefresh]);

  const imageUrl = useMemo(() => {
    return offlineCache.get(currentNFT.imageUrl || '') || currentNFT.imageUrl;
  }, [currentNFT.imageUrl, offlineCache]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black overflow-hidden touch-none"
      {...handlers}
      onTouchStart={handleTouchStart}
    >
      {/* Pull-to-refresh indicator */}
      <motion.div
        className="absolute top-0 left-1/2 transform -translate-x-1/2 z-50 mt-4"
        style={{ opacity: pullOpacity, scale: pullScale }}
      >
        <RefreshCw 
          className={`w-8 h-8 text-white ${isRefreshing ? 'animate-spin' : ''}`}
        />
      </motion.div>

      {/* Main content */}
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="relative z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
          <div className="flex justify-between items-center">
            <h1 className="text-white text-lg font-semibold truncate">
              {currentNFT.name}
            </h1>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-2"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Image viewer */}
        <div className="flex-1 relative flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: reducedMotion ? 0 : 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reducedMotion ? 0 : -100 }}
              transition={{ duration: reducedMotion ? 0 : 0.3 }}
              className="relative w-full h-full flex items-center justify-center p-4"
            >
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}
              
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={currentNFT.name}
                  className="max-w-full max-h-full object-contain rounded-lg"
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation dots */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            {nfts.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  triggerHaptic('light');
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex ? 'bg-white w-6' : 'bg-white/40'
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Action bar */}
        <div className="relative z-10 bg-gradient-to-t from-black/70 to-transparent p-4">
          <div className="flex justify-around items-center">
            <button
              onClick={handleLike}
              className="p-3 rounded-full bg-white/10 backdrop-blur-sm"
              aria-label="Like"
            >
              <Heart
                className={`w-6 h-6 ${
                  liked.has(currentNFT.id)
                    ? 'fill-red-500 text-red-500'
                    : 'text-white'
                }`}
              />
            </button>
            
            <button
              onClick={handleShare}
              className="p-3 rounded-full bg-white/10 backdrop-blur-sm"
              aria-label="Share"
            >
              <Share2 className="w-6 h-6 text-white" />
            </button>
            
            <button
              onClick={handleDownload}
              className="p-3 rounded-full bg-white/10 backdrop-blur-sm"
              aria-label="Download"
            >
              <Download className="w-6 h-6 text-white" />
            </button>
            
            <button
              onClick={() => {
                setShowDetails(true);
                triggerHaptic('light');
              }}
              className="p-3 rounded-full bg-white/10 backdrop-blur-sm"
              aria-label="Show details"
            >
              <Info className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom sheet for details */}
      <AnimatePresence>
        {showDetails && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => {
                setShowDetails(false);
                triggerHaptic('light');
              }}
            />
            
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.velocity.y > 500 || info.offset.y > 100) {
                  setShowDetails(false);
                  triggerHaptic('light');
                }
              }}
              className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl z-50 max-h-[80vh] overflow-hidden"
            >
              {/* Drag handle */}
              <div className="flex justify-center p-2">
                <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
              </div>
              
              {/* Details content */}
              <div className="p-6 pb-safe overflow-y-auto max-h-[70vh]">
                <h2 className="text-2xl font-bold text-white mb-4">
                  {currentNFT.name}
                </h2>
                
                {currentNFT.description && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">
                      Description
                    </h3>
                    <p className="text-gray-400">{currentNFT.description}</p>
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-300 mb-1">
                      Token ID
                    </h3>
                    <p className="text-gray-400 font-mono text-xs break-all">
                      {currentNFT.id}
                    </p>
                  </div>
                  
                  {currentNFT.creator && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-300 mb-1">
                        Creator
                      </h3>
                      <p className="text-gray-400 font-mono text-xs break-all">
                        {currentNFT.creator}
                      </p>
                    </div>
                  )}
                  
                  {currentNFT.createdAt && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-300 mb-1">
                        Created
                      </h3>
                      <p className="text-gray-400">
                        {new Date(currentNFT.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}