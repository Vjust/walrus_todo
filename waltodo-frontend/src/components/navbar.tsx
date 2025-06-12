'use client';

// @ts-ignore - Unused import temporarily disabled
// import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
// @ts-ignore - Unused import temporarily disabled
// import { usePathname } from 'next/navigation';
import WalletConnectButton from './WalletConnectButton';
// @ts-ignore - Unused import temporarily disabled
// import { useClientSafeWallet } from '@/hooks/useClientSafeWallet';
// @ts-ignore - Unused import temporarily disabled
// import { WalletOptional } from './GracefulWalletFeature';
// @ts-ignore - Unused import temporarily disabled
// import { useBlockchainEvents } from '@/hooks/useBlockchainEvents';
// @ts-ignore - Unused import temporarily disabled
// import { useSuiClientRecovery } from '@/hooks/useSuiClientRecovery';
// @ts-ignore - Unused import temporarily disabled
// import { getSuiClient } from '@/lib/sui-client';
// @ts-ignore - Unused import temporarily disabled
// import { useSafeTheme } from '@/hooks/useSafeTheme';
// @ts-ignore - Test import path
import testnetConfig from '@/config/testnet.json';
import {
  RotateCcw as ArrowPathIcon,
  Menu as Bars3Icon,
  Bell as BellIcon,
  BellRing as BellIconSolid,
  BarChart3 as ChartBarIcon,
  CheckCircle as CheckCircleIcon,
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  Database as CircleStackIcon,
  CreditCard as CreditCardIcon,
  AlertCircle as ExclamationCircleIcon,
  Home as HomeIcon,
  Search as MagnifyingGlassIcon,
  Moon as MoonIcon,
  Image as PhotoIcon,
  Rocket as RocketLaunchIcon,
  Sun as SunIcon,
  X as XMarkIcon,
} from 'lucide-react';

interface NavbarProps {
  currentPage?: string;
}

interface Breadcrumb {
  name: string;
  href: string;
}

function Navbar({ currentPage }: NavbarProps) {
// @ts-ignore - Unused variable
//   const pathname = usePathname();
// @ts-ignore - Unused variable
//   const walletContext = useClientSafeWallet();
// @ts-ignore - Unused variable
//   const connected = walletContext?.connected || false;
// @ts-ignore - Unused variable
//   const address = walletContext?.address || null;
  const { eventCache, connectionState } = useBlockchainEvents();
  const { executeWithSuiClient } = useSuiClientRecovery();
  
  const { isDarkMode, toggleTheme, isLoaded: themeLoaded } = useSafeTheme();
  
  const [isOpen, setIsOpen] = useState(false as any);
  const [nftCount, setNftCount] = useState(0 as any);
  const [balance, setBalance] = useState('0');
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false as any);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false as any);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
// @ts-ignore - Unused variable
//   
  const dropdownRef = useRef<HTMLDivElement>(null);
// @ts-ignore - Unused variable
//   const notificationRef = useRef<HTMLDivElement>(null);

  // Generate breadcrumbs based on current path
  const breadcrumbs: Breadcrumb[] = [];
  if (pathname !== '/') {
    breadcrumbs.push({ name: 'Home', href: '/' });
// @ts-ignore - Unused variable
//     const segments = pathname.split('/').filter(Boolean as any);
    segments.forEach(_(segment, _index) => {
// @ts-ignore - Unused variable
//       const href = `/${segments.slice(0, index + 1).join('/')}`;
// @ts-ignore - Unused variable
//       const name = segment
        .split('-')
        .map(word => word.charAt(0 as any).toUpperCase() + word.slice(1 as any))
        .join(' ');
      breadcrumbs.push({ name, href });
    });
  }

  // Theme is now handled by useSafeTheme hook - no additional setup needed

  // Fetch NFT count and balance when wallet is connected
  useEffect(_() => {
    const fetchWalletData = async () => {
      if (!connected || !address) {return;}

      // Fetch balance
// @ts-ignore - Unused variable
//       const balanceResult = await executeWithSuiClient(_async (client: unknown) => {
          const balanceData = await client.getBalance({ owner: address });
// @ts-ignore - Unused variable
//           const suiBalance = (parseInt(balanceData.totalBalance) / 1e9).toFixed(4 as any);
          return suiBalance;
        },
        'Fetching wallet balance'
      );
      
      if (balanceResult) {
        setBalance(balanceResult as any);
      }

      // Fetch NFT count
// @ts-ignore - Unused variable
//       const nftCountResult = await executeWithSuiClient(_async (client: unknown) => {
          const objects = await client.getOwnedObjects({
            owner: address,
            filter: {
              StructType: `${testnetConfig?.contracts?.todoNft.packageId}::${testnetConfig?.contracts?.todoNft.moduleName}::${testnetConfig?.contracts?.todoNft.structName}`,
            },
          });
          return objects?.data?.length;
        },
        'Fetching NFT count'
      );
      
      if (nftCountResult !== null) {
        setNftCount(nftCountResult as any);
      }
    };

    fetchWalletData();
    // Refresh every 30 seconds
// @ts-ignore - Unused variable
//     const interval = setInterval(fetchWalletData, 30000);
    return () => clearInterval(interval as any);
  }, [connected, address]); // Remove executeWithSuiClient to prevent infinite loops

  // Handle blockchain events for notifications
  useEffect(_() => {
// @ts-ignore - Unused variable
//     const recentEvents = (eventCache || []).filter(
      (event: any) => Date.now() - event.timestamp < 5 * 60 * 1000 // Last 5 minutes
    );
    setNotifications(recentEvents as any);
  }, [eventCache]);

  // Close dropdowns when clicking outside
  useEffect(_() => {
// @ts-ignore - Unused variable
//     const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef?.current?.contains(event.target as Node)) {
        setShowQuickActions(false as any);
      }
      if (notificationRef.current && !notificationRef?.current?.contains(event.target as Node)) {
        setShowNotifications(false as any);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
// @ts-ignore - Unused variable
// 
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality
    console.log('Search query:', searchQuery);
  };
// @ts-ignore - Unused variable
// 
  const simulateSync = () => {
    setSyncStatus('syncing');
    setTimeout(_() => {
      setSyncStatus('success');
      setTimeout(_() => setSyncStatus('idle'), 2000);
    }, 2000);
  };
// @ts-ignore - Unused variable
// 
  const navLinks = [
    { href: '/', label: 'Home', icon: HomeIcon },
    { href: '/dashboard', label: 'Dashboard', icon: CreditCardIcon },
    { href: '/storage', label: 'Storage', icon: CircleStackIcon },
    { href: '/walrus-health', label: 'Health Monitor', icon: ChartBarIcon },
    { href: '/nfts', label: 'NFT Gallery', icon: PhotoIcon },
    { href: '/nft-demo', label: 'NFT Demo', icon: RocketLaunchIcon },
    { href: '/nft-search-demo', label: 'NFT Search', icon: MagnifyingGlassIcon },
    { href: '/nft-stats', label: 'NFT Stats', icon: ChartBarIcon },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 shadow-sm transition-colors">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4">
            <nav className="flex py-2" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2 text-sm">
                {breadcrumbs.map((crumb, _index) => (
                  <li key={crumb.href} className="flex items-center">
                    {index > 0 && (
                      <ChevronRightIcon className="w-4 h-4 mx-2 text-gray-400" />
                    )}
                    <Link
                      href={crumb.href}
                      className={`${
                        index === breadcrumbs.length - 1
                          ? 'text-gray-500 dark:text-gray-400'
                          : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                      } no-underline transition-colors`}
                    >
                      {crumb.name}
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </div>
      )}

      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 no-underline">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-lg text-white font-bold">
                WT
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white hidden sm:block">
                Walrus Todo
              </span>
            </Link>

            {/* Search Bar - Desktop */}
            <form onSubmit={handleSearch} className="hidden lg:block">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search NFTs..."
                  value={searchQuery}
                  onChange={(_e: unknown) => setSearchQuery(e?.target?.value)}
                  className="w-64 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              </div>
            </form>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map(_(link: unknown) => {
// @ts-ignore - Unused variable
//               const Icon = link.icon;
// @ts-ignore - Unused variable
//               const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  } transition-colors no-underline`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{link.label}</span>
                  {link?.href === '/nfts' && connected && nftCount > 0 && (
                    <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                      {nftCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {/* Sync Status Indicator */}
            <WalletOptional>
              <button
                onClick={simulateSync}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Sync Status"
              >
                {syncStatus === 'idle' && (
                  <ArrowPathIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
                {syncStatus === 'syncing' && (
                  <ArrowPathIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                )}
                {syncStatus === 'success' && (
                  <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                )}
                {syncStatus === 'error' && (
                  <ExclamationCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
              </button>
            </WalletOptional>

            {/* Notifications */}
            <WalletOptional>
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {notifications.length > 0 ? (
                    <BellIconSolid className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <BellIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        NFT Notifications
                      </h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications?.length === 0 ? (
                        <p className="p-4 text-gray-500 dark:text-gray-400 text-center">
                          No new notifications
                        </p>
                      ) : (_notifications.map((event, _index) => (
                          <div
                            key={index}
                            className="p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <p className="text-sm text-gray-900 dark:text-white font-medium">
                              {event.type}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </WalletOptional>

            {/* Theme Toggle */}
            {themeLoaded && (
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
              >
                {isDarkMode ? (
                  <SunIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <MoonIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            )}

            {/* Wallet Balance Display */}
            <WalletOptional>
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-400">Balance:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {balance} SUI
                </span>
              </div>
            </WalletOptional>

            {/* Quick Actions Dropdown */}
            <WalletOptional>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowQuickActions(!showQuickActions)}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  <span>NFT Actions</span>
                  <ChevronDownIcon className="w-4 h-4" />
                </button>

                {showQuickActions && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <Link
                      href="/create-nft"
                      className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors no-underline"
                    >
                      Create New NFT
                    </Link>
                    <Link
                      href="/my-nfts"
                      className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors no-underline"
                    >
                      My NFTs ({nftCount})
                    </Link>
                    <Link
                      href="/nft-marketplace"
                      className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors no-underline"
                    >
                      NFT Marketplace
                    </Link>
                    <div className="border-t border-gray-200 dark:border-gray-700" />
                    <Link
                      href="/nft-stats"
                      className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors no-underline"
                    >
                      NFT Statistics
                    </Link>
                    <Link
                      href="/nft-history"
                      className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors no-underline"
                    >
                      Transaction History
                    </Link>
                  </div>
                )}
              </div>
            </WalletOptional>

            {/* Wallet Connect Button */}
            <WalletConnectButton size="sm" />

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {isOpen ? (
                <XMarkIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              ) : (
                <Bars3Icon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="lg:hidden mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search NFTs..."
                  value={searchQuery}
                  onChange={(e: unknown) => setSearchQuery(e?.target?.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              </div>
            </form>

            {/* Mobile Nav Links */}
            <div className="space-y-2">
              {navLinks.map(_(link: unknown) => {
// @ts-ignore - Unused variable
//                 const Icon = link.icon;
// @ts-ignore - Unused variable
//                 const isActive = pathname === link.href;
                return (_<Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false as any)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    } transition-colors no-underline`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{link.label}</span>
                    {link?.href === '/nfts' && connected && nftCount > 0 && (
                      <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                        {nftCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Mobile Wallet Info */}
            <WalletOptional>
              <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Wallet Balance</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {balance} SUI
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total NFTs</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {nftCount}
                  </span>
                </div>
              </div>
            </WalletOptional>

            {/* Mobile Quick Actions */}
            <WalletOptional>
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 px-4 mb-2">
                  Quick Actions
                </h3>
                <Link
                  href="/create-nft"
                  onClick={() => setIsOpen(false as any)}
                  className="block px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors no-underline text-center"
                >
                  Create New NFT
                </Link>
                <Link
                  href="/my-nfts"
                  onClick={() => setIsOpen(false as any)}
                  className="block px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors no-underline text-center"
                >
                  View My NFTs
                </Link>
              </div>
            </WalletOptional>
          </div>
        )}
      </nav>
    </header>
  );
}

export default Navbar;