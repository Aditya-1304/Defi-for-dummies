'use client';

import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { clearConnectionCache } from '@/services/solana-service';

type NetworkType = 'localnet' | 'devnet' | 'mainnet';

interface NetworkContextType {
  network: NetworkType;
  setNetwork: (network: NetworkType) => void;
}

const NetworkContext = createContext<NetworkContextType>({
  network: 'localnet',
  setNetwork: () => {},
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  // Initialize from URL or localStorage
  const [network, setNetworkState] = useState<NetworkType>('localnet');
  
  // Initialize on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const networkParam = params.get('network');
      
      if (networkParam === 'devnet' || networkParam === 'mainnet') {
        setNetworkState(networkParam as NetworkType);
      } else {
        // Default to localnet
        setNetworkState('localnet');
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