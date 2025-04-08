'use client';

import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { getAllWalletBalances, getTokenBalancesOnly } from '../../services/solana-service';

interface WalletBalancesProps {
  network: 'localnet' | 'devnet' | 'mainnet';
}

export function WalletBalances({ network }: WalletBalancesProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [balances, setBalances] = useState<Array<{token: string, balance: number, decimals: number}>>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBalances() {
      // Reset states when wallet or network changes
      setLoading(true);
      setLoadingTokens(true);
      setError(null);

      if (!wallet.publicKey) {
        setLoading(false);
        setLoadingTokens(false);
        return;
      }
      
      try {
        // Quick initial load with just SOL balance
        console.log(`Loading initial SOL balance for ${wallet.publicKey.toString()}`);
        const initialResult = await getAllWalletBalances(
          connection, wallet, network, { initialOnly: false }
        );
        
        if (initialResult.success) {
          setBalances(initialResult.balances ?? []);
          setLoading(false);
          
          // Then load token balances in background
          console.log("Initial balance loaded, now loading token balances...");
          const tokenResult = await getTokenBalancesOnly(
            connection, wallet, network
          );
          
          if (tokenResult.success) {
            // Merge balances, keeping existing SOL balance
            setBalances(prev => {
              const solBalance = prev.find(b => b.token === 'SOL');
              return [
                ...(solBalance ? [solBalance] : []),
                ...(tokenResult.balances ?? [])
              ];
            });
          } else if (tokenResult.error) {
            console.error("Token balance error:", tokenResult.error);
            setError(`Failed to load token balances: ${tokenResult.error}`);
          }
        } else if (initialResult.error) {
          setError(`Failed to load balances: ${initialResult.error}`);
        }
      } catch (err) {
        console.error("Error loading balances:", err);
        setError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
        setLoadingTokens(false);
      }
    }
    
    loadBalances();
  }, [connection, wallet, network]);
  
  if (!wallet.publicKey) {
    return <p>Connect wallet to view balances</p>;
  }
  
  return (
    <div className="wallet-balances">
      <h2>Wallet Balances</h2>
      
      {loading ? (
        <p>Loading balances...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        <div>
          {balances.length > 0 ? (
            <ul className="balance-list">
              {balances.map(b => (
                <li key={b.token} className="balance-item">
                  <span className="token">{b.token}</span>
                  <span className="amount">{b.balance.toFixed(b.token === 'SOL' ? 7 : 2)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No balances found</p>
          )}
          
          {loadingTokens && <p className="loading-message">Loading additional tokens...</p>}
        </div>
      )}
    </div>
  );
}