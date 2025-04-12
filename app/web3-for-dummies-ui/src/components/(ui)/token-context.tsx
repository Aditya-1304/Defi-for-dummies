"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { fetchUserTokens } from '@/services/tokens-service';
import { getNetworkConnection } from '@/services/solana-service';
import { useNetwork } from './network-context';
import { tokenFetchManager } from '@/services/token-fetch-manager';

// Token information type
interface TokenBalanceInfo {
  mint: string;
  balance: number;
  symbol: string;
  decimals: number;
}

interface TokenContextType {
  tokens: TokenBalanceInfo[];
  refreshTokens: (forceRefresh?: boolean) => Promise<void>;
  isLoading: boolean;
}

const TokenContext = createContext<TokenContextType>({
  tokens: [],
  refreshTokens: async () => {},
  isLoading: false,
});

export const useTokens = () => useContext(TokenContext);

export function TokenProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<TokenBalanceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { publicKey } = useWallet();
  const { network } = useNetwork();
  const isInitialMount = useRef(true);
  
  // Flag to track whether tokens have ever been loaded
  const hasLoadedTokens = useRef(false);

  const refreshTokens = async (forceRefresh = false) => {
    if (!publicKey) {
      setTokens([]);
      return;
    }

    // Skip if we should be blocking token fetches (unless forced)
    if (!forceRefresh && tokenFetchManager.shouldBlockTokenFetch()) {
      console.log("⏯️ TokenProvider: Skipping token fetch during app initialization");
      return;
    }

    setIsLoading(true);
    try {
      const connection = getNetworkConnection(network);
      const fetchedTokens = await fetchUserTokens(
        connection, 
        publicKey, 
        network,
        { 
          hideUnknown: false,
          // Only skip if it's not a forced refresh
          skipInitialFetch: !forceRefresh && isInitialMount.current 
        }
      );
      
      // If we get tokens back, update the state
      if (fetchedTokens.length > 0 || forceRefresh) {
        setTokens(fetchedTokens);
        hasLoadedTokens.current = true;
      }
    } catch (error) {
      console.error('Error refreshing tokens:', error);
    } finally {
      setIsLoading(false);
      isInitialMount.current = false;
    }
  };

  // Refresh tokens when wallet or network changes, but NOT on initial mount
  useEffect(() => {
    // Skip the initial mount
    if (isInitialMount.current) {
      console.log("⏯️ TokenProvider: Skipping initial token fetch");
      isInitialMount.current = false;
      return;
    }

    // Only fetch if we've previously loaded tokens or wallet just connected
    if (hasLoadedTokens.current || publicKey) {
      console.log("TokenProvider: Refreshing tokens due to wallet/network change");
      refreshTokens();
    }
  }, [publicKey, network]);

  return (
    <TokenContext.Provider value={{ tokens, refreshTokens, isLoading }}>
      {children}
    </TokenContext.Provider>
  );
}