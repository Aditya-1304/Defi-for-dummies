import { Connection, PublicKey } from '@solana/web3.js';
import { TokenInfo } from './tokens-service';

export type TokenMetadata = {
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  source: 'registry' | 'on-chain' | 'local' | 'user-defined';
};

// Official Solana Token List
const SOLANA_TOKEN_LIST_URL = 'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json';

// In-memory caches
let tokenRegistryCache: Record<string, TokenMetadata> = {};
let mintToMetadataCache: Record<string, TokenMetadata> = {};



/**
 * Resolves token information using multiple sources
 */
export async function resolveTokenInfo(
  connection: Connection,
  mintAddress: string,
  network: "localnet" | "devnet" | "mainnet"
): Promise<TokenMetadata | null> {
  try {
    // Step 1: Check our in-memory cache
    if (mintToMetadataCache[mintAddress]) {
      return mintToMetadataCache[mintAddress];
    }

    // Step 2: Check IndexedDB
    const fromIndexedDB = await getTokenFromIndexedDB(mintAddress);
    if (fromIndexedDB) {
      mintToMetadataCache[mintAddress] = fromIndexedDB;
      return fromIndexedDB;
    }

    // Step 3: Check localStorage (legacy support)
    const fromLocalStorage = getTokenFromLocalStorage(mintAddress, network);
    if (fromLocalStorage) {
      // Save to IndexedDB for future use
      await saveTokenToIndexedDB(mintAddress, fromLocalStorage);
      mintToMetadataCache[mintAddress] = fromLocalStorage;
      return fromLocalStorage;
    }

    // Step 4: Check Solana Token Registry
    const fromRegistry = await getTokenFromRegistry(mintAddress, network);
    if (fromRegistry) {
      // Save to both storage mechanisms
      await saveTokenToIndexedDB(mintAddress, fromRegistry);
      saveTokenToLocalStorage(mintAddress, fromRegistry, network);
      mintToMetadataCache[mintAddress] = fromRegistry;
      return fromRegistry;
    }

    // Step 5: Fallback to basic mint info
    const basicInfo = await getTokenMetadataFromChain(connection, mintAddress);
    if (basicInfo) {
      await saveTokenToIndexedDB(mintAddress, basicInfo);
      saveTokenToLocalStorage(mintAddress, basicInfo, network);
      mintToMetadataCache[mintAddress] = basicInfo;
      return basicInfo;
    }

    // Token couldn't be identified
    return null;
  } catch (error) {
    console.error("Error resolving token info:", error);
    return null;
  }
}

/**
 * Gets token from Solana Token Registry
 */
async function getTokenFromRegistry(
  mintAddress: string,
  network: string
): Promise<TokenMetadata | null> {
  try {
    // Load registry if not loaded
    if (Object.keys(tokenRegistryCache).length === 0) {
      const response = await fetch(SOLANA_TOKEN_LIST_URL);
      if (!response.ok) throw new Error('Failed to fetch token list');
      
      const tokenList = await response.json();
      
      // Filter tokens for the current network and index by mint address
      tokenList.tokens.forEach((token: any) => {
        // Skip tokens that don't match our network
        if ((network === 'devnet' && token.tags?.includes('devnet')) ||
            (network === 'mainnet' && !token.tags?.includes('devnet'))) {
          tokenRegistryCache[token.address] = {
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoURI: token.logoURI,
            tags: token.tags,
            source: 'registry'
          };
        }
      });
    }

    // Return from cache if found
    return tokenRegistryCache[mintAddress] || null;
  } catch (error) {
    console.error("Error fetching from token registry:", error);
    return null;
  }
}

/**
 * Gets token metadata directly from on-chain Metaplex metadata
 */
async function getTokenMetadataFromChain(
  connection: Connection,
  mintAddress: string
): Promise<TokenMetadata | null> {
  try {
    // Find metadata PDA for the mint
    const mintPublicKey = new PublicKey(mintAddress);
    
    // Get mint account info to determine decimals
    try {
      const mintInfo = await connection.getAccountInfo(mintPublicKey);
      if (!mintInfo) return null;
      
      // Extract decimals (simplistic approach - byte 44 in mint data)
      // Format of mint account: https://github.com/solana-labs/solana-program-library/blob/master/token/program/src/state.rs#L86
      const decimals = mintInfo.data[44] || 0;
      
      // Create a simple metadata since we can't reliably get name/symbol on-chain without Metaplex
      return {
        symbol: mintAddress.substring(0, 4).toUpperCase(),
        name: `Token ${mintAddress.substring(0, 8)}`,
        decimals: decimals,
        source: 'on-chain'
      };
    } catch (err) {
      console.error("Error fetching mint info:", err);
      return null;
    }
  } catch (error) {
    console.error("Error in getTokenMetadataFromChain:", error);
    return null;
  }
}

/**
 * IndexedDB Implementation for token storage
 */
async function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TokenDatabase', 1);
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('tokens')) {
        db.createObjectStore('tokens', { keyPath: 'mintAddress' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getTokenFromIndexedDB(mintAddress: string): Promise<TokenMetadata | null> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['tokens'], 'readonly');
      const store = transaction.objectStore('tokens');
      const request = store.get(mintAddress);
      
      request.onsuccess = () => resolve(request.result?.metadata || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("IndexedDB get error:", error);
    return null;
  }
}

async function saveTokenToIndexedDB(mintAddress: string, metadata: TokenMetadata): Promise<void> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['tokens'], 'readwrite');
      const store = transaction.objectStore('tokens');
      const request = store.put({
        mintAddress,
        metadata,
        updatedAt: Date.now()
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("IndexedDB save error:", error);
  }
}

/**
 * Legacy localStorage functions
 */
function getTokenFromLocalStorage(
  mintAddress: string,
  network: string
): TokenMetadata | null {
  try {
    const storageKey = `token-mapping-${network}`;
    const mappings = localStorage.getItem(storageKey);
    if (!mappings) return null;
    
    const parsed = JSON.parse(mappings);
    if (!parsed[mintAddress]) return null;
    
    return {
      symbol: parsed[mintAddress].symbol,
      name: parsed[mintAddress].symbol, // Name not stored in old format
      decimals: parsed[mintAddress].decimals,
      source: 'local'
    };
  } catch (error) {
    console.error("LocalStorage get error:", error);
    return null;
  }
}

function saveTokenToLocalStorage(
  mintAddress: string,
  metadata: TokenMetadata,
  network: string
): void {
  try {
    const storageKey = `token-mapping-${network}`;
    const existing = localStorage.getItem(storageKey);
    const mappings = existing ? JSON.parse(existing) : {};
    
    mappings[mintAddress] = {
      symbol: metadata.symbol,
      decimals: metadata.decimals
    };
    
    localStorage.setItem(storageKey, JSON.stringify(mappings));
  } catch (error) {
    console.error("LocalStorage save error:", error);
  }
}

/**
 * Registers a user-defined token
 */
export async function registerUserToken(
  mintAddress: string,
  symbol: string,
  decimals: number,
  network: string
): Promise<boolean> {
  try {
    const metadata: TokenMetadata = {
      symbol,
      name: symbol, // Use symbol as name if not provided
      decimals,
      source: 'user-defined'
    };
    
    // Save to all storage mechanisms
    await saveTokenToIndexedDB(mintAddress, metadata);
    saveTokenToLocalStorage(mintAddress, metadata, network);
    mintToMetadataCache[mintAddress] = metadata;
    
    return true;
  } catch (error) {
    console.error("Error registering user token:", error);
    return false;
  }
}

/**
 * Convert TokenMetadata to TokenInfo
 */
export function convertToTokenInfo(
  mintAddress: string,
  metadata: TokenMetadata
): TokenInfo {
  return {
    mint: new PublicKey(mintAddress),
    decimals: metadata.decimals,
    symbol: metadata.symbol,
    name: metadata.name,
    logoURI: metadata.logoURI
  };
}

/**
 * Clears token caches (used for testing/debugging)
 */
export function clearTokenCaches(): void {
  tokenRegistryCache = {};
  mintToMetadataCache = {};
}