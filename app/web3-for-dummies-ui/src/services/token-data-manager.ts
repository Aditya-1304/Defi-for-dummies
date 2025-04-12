import { Connection, PublicKey } from '@solana/web3.js';
import { fetchUserTokens } from './tokens-service';

// In-memory token cache that persists during the session
interface TokenCache {
  [key: string]: {
    tokens: any[];
    lastFetched: number;
    network: string;
  }
}

// Singleton instance for token data management
class TokenDataManager {
  private tokenCache: TokenCache = {};
  private cacheExpiryMs: number = 60 * 1000; // 1 minute cache

  constructor() {
    console.log('Token Data Manager initialized');
  }

  // Get token data with caching
  async getTokenData(
    connection: Connection,
    wallet: any,
    network: string,
    forceRefresh: boolean = false
  ) {
    if (!wallet?.publicKey) return [];
  
    // Check if this is triggered by a user action or automatic
    const isUserInitiated = forceRefresh || 
      (typeof document !== 'undefined' && document.readyState === 'complete' && 
       document.hasFocus() && performance.now() > 5000);
    
    const cacheKey = this.getCacheKey(wallet.publicKey, network);
    const currentTime = Date.now();
  
    // Use cache if valid and not forcing refresh
    if (
      !forceRefresh &&
      this.tokenCache[cacheKey] &&
      currentTime - this.tokenCache[cacheKey].lastFetched < this.cacheExpiryMs &&
      this.tokenCache[cacheKey].network === network
    ) {
      console.log("Using cached token data from token manager");
      return this.tokenCache[cacheKey].tokens;
    }
  
    // Skip network fetch during initial page load unless explicitly forced
    if (!isUserInitiated && !forceRefresh) {
      console.log("Skipping token fetch - automated request during page initialization");
      
      // Return cached data if available, even if expired
      if (this.tokenCache[cacheKey]) {
        console.log("Returning stale cache data instead of fetching");
        return this.tokenCache[cacheKey].tokens;
      }
      
      return [];
    }
  
    console.log(`Fetching fresh token data for ${network}`);
    try {
      const tokens = await fetchUserTokens(
        connection,
        wallet.publicKey,
        network as any,
        { 
          hideUnknown: false,
          skipInitialFetch: !isUserInitiated && !forceRefresh
        }
      );
  
      // Only cache if we actually got tokens
      if (tokens.length > 0 || isUserInitiated) {
        this.tokenCache[cacheKey] = {
          tokens,
          lastFetched: currentTime,
          network
        };
      }
  
      return tokens;
    } catch (error) {
      console.error("Error fetching token data:", error);
      throw error;
    }
  }

  // Invalidate cache for specific wallet and network
  invalidateCache(wallet: any, network: string) {
    if (!wallet?.publicKey) return;
    
    const cacheKey = this.getCacheKey(wallet.publicKey, network);
    if (this.tokenCache[cacheKey]) {
      console.log(`Invalidating token cache for ${network}`);
      delete this.tokenCache[cacheKey];
    }
  }

  // Clear entire cache
  clearAllCaches() {
    console.log("Clearing all token caches");
    this.tokenCache = {};
  }

  // Helper to generate cache keys
  private getCacheKey(publicKey: PublicKey, network: string): string {
    return `${publicKey.toString()}-${network}`;
  }

  // Only load metadata, no balances
  preloadTokenMetadata() {
    // We don't need to do anything here - the metadata loading
    // is handled by preloadTokensFromLocalStorage
    console.log("Token metadata preloading handled separately");
  }
}

// Export a singleton instance
export const getTokenData = new TokenDataManager();