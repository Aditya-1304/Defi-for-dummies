"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function WalletButton() {
  const { connected } = useWallet();
  const [mounted, setMounted] = useState(false);

  // Only show the component after it's mounted on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR, hide the button to prevent hydration mismatch
  if (!mounted) {
    return <Button variant="outline" size={"lg"} disabled>Connect Wallet</Button>;
  }

  return (
    <WalletMultiButton className="bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded transition-colors" />
  );
}