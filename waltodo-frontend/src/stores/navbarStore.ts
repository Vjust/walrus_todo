import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface NavbarState {
  // Menu states
  isOpen: boolean;
  showQuickActions: boolean;
  showNotifications: boolean;
  
  // Wallet data
  nftCount: number;
  balance: string;
  
  // Search
  searchQuery: string;
  
  // Notifications
  notifications: any[];
  
  // Sync status
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  
  // Actions
  setIsOpen: (isOpen: boolean) => void;
  setShowQuickActions: (show: boolean) => void;
  setShowNotifications: (show: boolean) => void;
  setNftCount: (count: number) => void;
  setBalance: (balance: string) => void;
  setSearchQuery: (query: string) => void;
  setNotifications: (notifications: any[]) => void;
  setSyncStatus: (status: 'idle' | 'syncing' | 'success' | 'error') => void;
  
  // Utility actions
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  closeAllDropdowns: () => void;
  addNotification: (notification: any) => void;
  clearNotifications: () => void;
  reset: () => void;
}

const initialState = {
  isOpen: false,
  showQuickActions: false,
  showNotifications: false,
  nftCount: 0,
  balance: '0',
  searchQuery: '',
  notifications: [],
  syncStatus: 'idle' as const,
};

export const useNavbarStore = create<NavbarState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    // Basic setters
    setIsOpen: (isOpen: boolean) => set({ isOpen }),
    setShowQuickActions: (showQuickActions: boolean) => set({ showQuickActions }),
    setShowNotifications: (showNotifications: boolean) => set({ showNotifications }),
    setNftCount: (nftCount: number) => set({ nftCount }),
    setBalance: (balance: string) => set({ balance }),
    setSearchQuery: (searchQuery: string) => set({ searchQuery }),
    setNotifications: (notifications: any[]) => set({ notifications }),
    setSyncStatus: (syncStatus: 'idle' | 'syncing' | 'success' | 'error') => set({ syncStatus }),
    
    // Utility actions
    toggleMobileMenu: () => {
      const { isOpen } = get();
      set({ isOpen: !isOpen });
    },
    
    closeMobileMenu: () => set({ isOpen: false }),
    
    closeAllDropdowns: () => set({ 
      showQuickActions: false, 
      showNotifications: false 
    }),
    
    addNotification: (notification: any) => {
      const { notifications } = get();
      set({ notifications: [notification, ...notifications] });
    },
    
    clearNotifications: () => set({ notifications: [] }),
    
    reset: () => set(initialState),
  }))
);

// Selectors for performance optimization
export const useNavbarMenuState = () => {
  return useNavbarStore((state) => ({
    isOpen: state.isOpen,
    showQuickActions: state.showQuickActions,
    showNotifications: state.showNotifications,
  }));
};

export const useNavbarWalletData = () => {
  return useNavbarStore((state) => ({
    nftCount: state.nftCount,
    balance: state.balance,
  }));
};

export const useNavbarSearch = () => {
  return useNavbarStore((state) => ({
    searchQuery: state.searchQuery,
    setSearchQuery: state.setSearchQuery,
  }));
};

export const useNavbarNotifications = () => {
  return useNavbarStore((state) => ({
    notifications: state.notifications,
    showNotifications: state.showNotifications,
  }));
};

export const useNavbarSyncStatus = () => {
  return useNavbarStore((state) => ({
    syncStatus: state.syncStatus,
    setSyncStatus: state.setSyncStatus,
  }));
};