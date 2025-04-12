"use client";
import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Dialog } from '../ui/dialog';
import { useWallet } from '@solana/wallet-adapter-react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { registerUserToken } from '@/services/token-metadat-service';

interface TokenRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  network: "localnet" | "devnet" | "mainnet";
  onSuccess?: () => void;
}

export function TokenRegistrationModal({ 
  isOpen, 
  onClose, 
  network,
  onSuccess 
}: TokenRegistrationModalProps) {
  const [mintAddress, setMintAddress] = useState('');
  const [symbol, setSymbol] = useState('');
  const [decimals, setDecimals] = useState('9');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const wallet = useWallet(); 
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!wallet.connected || !wallet.publicKey) {
      setError('Wallet disconnected. Please connect your wallet and try again.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Rest of your code...
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
    
    try {
      // Validate mint address
      try {
        new PublicKey(mintAddress);
      } catch (err) {
        throw new Error('Invalid mint address format');
      }
      
      // Validate symbol
      if (!symbol.trim()) {
        throw new Error('Symbol is required');
      }
      
      // Validate decimals
      const parsedDecimals = parseInt(decimals);
      if (isNaN(parsedDecimals) || parsedDecimals < 0 || parsedDecimals > 9) {
        throw new Error('Decimals must be a number between 0 and 9');
      }
      
      // Register the token
      const success = await registerUserToken(
        mintAddress,
        symbol.toUpperCase(),
        parsedDecimals,
        network
      );
      
      if (success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        throw new Error('Failed to register token');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">Register Custom Token</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="mintAddress">Token Mint Address</Label>
              <Input
                id="mintAddress"
                value={mintAddress}
                onChange={(e) => setMintAddress(e.target.value)}
                placeholder="Enter mint address"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="symbol">Token Symbol</Label>
              <Input
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="e.g. USDC"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="decimals">Decimals</Label>
              <Input
                id="decimals"
                type="number"
                min={0}
                max={9}
                value={decimals}
                onChange={(e) => setDecimals(e.target.value)}
                required
              />
            </div>
            
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Registering...' : 'Register Token'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Dialog>
  );
}