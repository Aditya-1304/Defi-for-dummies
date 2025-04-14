"use client"

import { JupiterSwapModal } from "@/components/(ui)/swap-modal";
import { Button } from "@/components/ui/button";
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { ArrowDownUp } from "lucide-react";
import { useEffect, useState } from "react";

export default function SwapPage() {
  const {connection} = useConnection();
  const wallet = useWallet();
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(true);
  const [swapHistory, setSwapHistory] = useState<any[]>([]);
  const [network, setNetwork] = useState<'localnet' | "devnet" | "mainnet">("localnet");


  useEffect(() => {
    // Get network from URL parameters
    const params = new URLSearchParams(window.location.search);
    const urlNetwork = params.get("network");
    if (urlNetwork === "devnet" || urlNetwork === "mainnet") {
      setNetwork(urlNetwork);
    }
  }, []);

  const handleSwapSuccess = (result: any) => {
    setSwapHistory(prev => [result, ...prev]);

    setTimeout(() => {
      setIsSwapModalOpen(true);
    }, 1500);
  };

  const handleSwapError = (error: any) => {
    console.log("Swap failed:", error);
  };

  return (
    <div className="container max-w-4xl py-8 min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 dark:from-gray-950 dark:to-gray-900 light:from-gray-100 light:to-white text-gray-100 dark:text-gray-100 light:text-gray-800" >
      <div className="flex flex-col items-center justify-center space-y-6 text-center">
        <p className="text-muted-foreground max-w-[600px">
          Swap between any token pair with the best rates via Jupiter.
        </p>

        <Button
          size={"lg"}
          onClick={()=> setIsSwapModalOpen(true)}
          className="flex items-center gap-2"
          disabled={!wallet.connected}
        >
          <ArrowDownUp className="h-5 w-5" />
          {wallet.connected ? "Open Swap Interface" : "Connect Wallet to Swap"}
        </Button>

        {swapHistory.length > 0 && (
          <div className="w-full mt-8">
            <h2 className="text-xl font-semibold mb-4 text-left">
              Recent swaps
            </h2>
            <div className="space-y-3">
              {swapHistory.map((swap, index) => (
                <div key={index} className="bg-card p-4 rounded-lg flex justify-between">
                  <div>
                    <p>
                      {swap.inputAmount.toFixed(6)} {swap.fromTokenSymbol} → {swap.outputAmount.toFixed(6)} {swap.toTokenSymbol}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                  <a 
                    href={swap.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline"
                    >
                      View transaction
                    </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <JupiterSwapModal 
          isOpen= {isSwapModalOpen && wallet.connected}
          onClose={() => setIsSwapModalOpen(false)}
          onSuccess={handleSwapSuccess}
          onError={handleSwapError}
          network="localnet"
          initialFromToken=""
          initialToToken=""
        />
      </div>
    </div>
  )

}