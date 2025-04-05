// // src/components/wallet/wallet-provider.tsx
'use client';

import { FC, ReactNode, useEffect, useMemo, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

interface Props {
  children: ReactNode;
}

export const WalletContextProvider: FC<Props> = ({ children }) => {

  const [network, setNetwork] = useState<'localnet' | 'devnet' | 'mainnet'>('localnet');
  
  const walletNetwork = useMemo(() => {
    switch(network) {
      case 'devnet':
        return WalletAdapterNetwork.Devnet;
      case 'mainnet':
        return WalletAdapterNetwork.Mainnet;
      default:
        return WalletAdapterNetwork.Devnet; // Use Devnet for localnet
    }
  }, [network]);

  // You can also provide a custom RPC endpoint
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const networkParam = params.get('network');
    
    console.log("WalletProvider: URL network parameter =", networkParam);
    console.log("Current network in state =", network);
    
    // Get current endpoint from connection (if it exists)
    const currentEndpoint = window.localStorage.getItem('network');
    console.log("Current network in localStorage =", currentEndpoint);
    
    if (networkParam === 'devnet') {
      console.log("Setting network to devnet");
      setNetwork('devnet');
      window.localStorage.setItem('network', 'devnet');
    } else if (networkParam === 'mainnet') {
      console.log("Setting network to mainnet");
      setNetwork('mainnet');
      window.localStorage.setItem('network', 'mainnet');
    } else {
      console.log("Setting network to localnet");
      setNetwork('localnet');
      window.localStorage.setItem('network', 'localnet');
    }
  }, []);

  // Define endpoints for different networks
  const endpoint = useMemo(() => {
    switch(network) {
      case 'devnet':
        return 'https://api.devnet.solana.com';
      case 'mainnet':
        return 'https://api.mainnet-beta.solana.com';
      case 'localnet':
      default:
        return 'http://localhost:8899';
    }
  }, [network]);
  

  // Initialize wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: walletNetwork }),
    ],
    [walletNetwork]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

// src/providers.tsx
// "use client";

// import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
// import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
// import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
// import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
// import { useMemo, useState } from 'react';
// import { useSearchParams } from 'next/navigation';

// const NETWORK_URLS = {
//   localnet: "http://localhost:8899",
//   devnet: "https://api.devnet.solana.com",
//   mainnet: "https://api.mainnet-beta.solana.com"
// };

// export function WalletContextProvider({ children }: { children: React.ReactNode }) {
//   const searchParams = useSearchParams();
//   const networkParam = searchParams.get('network');
  
//   // Set the correct endpoint based on URL parameter
//   const endpoint = useMemo(() => {
//     if (networkParam === 'devnet') {
//       return NETWORK_URLS.devnet;
//     } else if (networkParam === 'mainnet') {
//       return NETWORK_URLS.mainnet;
//     } else {
//       return NETWORK_URLS.localnet;
//     }
//   }, [networkParam]);

//   // Set up supported wallets
//   const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

//   return (
//     <ConnectionProvider endpoint={endpoint}>
//       <WalletProvider wallets={wallets} autoConnect>
//         <WalletModalProvider>{children}</WalletModalProvider>
//       </WalletProvider>
//     </ConnectionProvider>
//   );
// }