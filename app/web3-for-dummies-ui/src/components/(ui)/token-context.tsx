"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { fetchUserTokens } from '@/services/tokens-service';
import { getNetworkConnection } from '@/services/solana-service';
import { useNetwork } from './network-context';

// Token information type
interface TokenBalanceInfo {
  mint: string;
  balance: number;
  symbol: string;
  decimals: number;
}

interface TokenContextType {
  tokens: TokenBalanceInfo[];
  refreshTokens: () => Promise<void>;
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

  const refreshTokens = async () => {
    if (!publicKey) {
      setTokens([]);
      return;
    }

    setIsLoading(true);
    try {
      const connection = getNetworkConnection(network);
      const fetchedTokens = await fetchUserTokens(connection, publicKey, network);
      setTokens(fetchedTokens);
    } catch (error) {
      console.error('Error refreshing tokens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh tokens when wallet or network changes
  useEffect(() => {
    refreshTokens();
  }, [publicKey, network]);

  return (
    <TokenContext.Provider value={{ tokens, refreshTokens, isLoading }}>
      {children}
    </TokenContext.Provider>
  );
}