'use client';

import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { clearConnectionCache } from '@/services/solana-service';

type NetworkType = 'localnet' | 'devnet' | 'mainnet';

interface NetworkContextType {
  network: NetworkType;
  setNetwork: (network: NetworkType) => void;
}

const NetworkContext = createContext<NetworkContextType>({
  network: 'devnet',
  setNetwork: () => {},
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  // Initialize from URL or localStorage
  const [network, setNetworkState] = useState<NetworkType>('devnet');
  
  // Initialize on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const networkParam = params.get('network');
      const storedNetwork = localStorage.getItem('network') as NetworkType | null;

      let initialNetwork: NetworkType = 'devnet'; // Changed default

      if (networkParam === 'localnet' || networkParam === 'devnet' || networkParam === 'mainnet') {
        initialNetwork = networkParam;
      } else if (storedNetwork === 'localnet' || storedNetwork === 'devnet' || storedNetwork === 'mainnet') {
        initialNetwork = storedNetwork;
      }

      setNetworkState(initialNetwork);
      // Update URL if it doesn't match the determined initial network
      if (networkParam !== initialNetwork) {
         const url = new URL(window.location.href);
         url.searchParams.set('network', initialNetwork);
         window.history.replaceState({}, '', url.toString()); // Use replaceState to avoid polluting history on load
      }
    }
  }, []);
  
  const setNetwork = (newNetwork: NetworkType) => {
    setNetworkState(newNetwork);
    
    // Update URL without page reload
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('network', newNetwork);
      window.history.pushState({}, '', url.toString());
      
      // Save to localStorage
      localStorage.setItem('network', newNetwork);
      
      // Clear connection cache to force new connections with correct network
      clearConnectionCache();
    }
  };
  
  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}