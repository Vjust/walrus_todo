'use client';

import React, { useState, useEffect } from 'react';
import { pwaManager } from '@/lib/pwa-manager';
import { X, Download, Smartphone, Share } from 'lucide-react';

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    setIsInstalled(pwaManager.isInstalled());
    
    // Check for iOS
    const checkIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(checkIOS);

    // Show prompt after delay if can install
    const timer = setTimeout(() => {
      if (!pwaManager.isInstalled() && (pwaManager.canInstall() || checkIOS)) {
        setShowPrompt(true);
      }
    }, 30000); // Show after 30 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      // For iOS, we can't trigger install, just show instructions
      return;
    }

    const installed = await pwaManager.showInstallPrompt();
    if (installed) {
      setShowPrompt(false);
      setIsInstalled(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for 7 days
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (!showPrompt || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-slide-up">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-sky-500 to-indigo-600 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-white font-semibold">Install WalTodo</h3>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-slate-300 text-sm mb-4">
            Install WalTodo for a better experience with offline access, push notifications, and quick access from your home screen.
          </p>

          {/* Features */}
          <ul className="space-y-2 mb-4">
            <li className="flex items-center gap-2 text-sm text-slate-400">
              <span className="text-emerald-500">✓</span>
              Works offline - access your NFTs anywhere
            </li>
            <li className="flex items-center gap-2 text-sm text-slate-400">
              <span className="text-emerald-500">✓</span>
              Get notified about NFT events
            </li>
            <li className="flex items-center gap-2 text-sm text-slate-400">
              <span className="text-emerald-500">✓</span>
              Quick access from home screen
            </li>
          </ul>

          {/* Install button or iOS instructions */}
          {isIOS ? (
            <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
              <p className="text-sm text-slate-300 mb-2">To install on iOS:</p>
              <ol className="space-y-1 text-xs text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-sky-400">1.</span>
                  Tap the <Share className="inline w-3 h-3" /> share button
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-sky-400">2.</span>
                  Scroll down and tap "Add to Home Screen"
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-sky-400">3.</span>
                  Tap "Add" to install
                </li>
              </ol>
            </div>
          ) : (
            <button
              onClick={handleInstall}
              className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all transform hover:scale-[1.02]"
            >
              <Download className="w-5 h-5" />
              Install App
            </button>
          )}

          {/* Dismiss option */}
          <button
            onClick={handleDismiss}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-400 mt-2 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}