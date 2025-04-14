import React, {useState, useEffect} from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { getJupiterTokens, getSwapRoutes, executeJupiterSwap } from "@/services/swap-service";

import { Dialog,DialogContent, DialogHeader } from "../ui/dialog";
import { DialogTitle } from "../ui/dialog";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { AlertCircle, ArrowDownUp, Loader2, Percent } from "lucide-react";

type SwapModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: any) => void;
  onError: (error: any) => void;
  network: "devnet" | "mainnet" | "localnet";
  initialFromToken?: string;
  initialToToken?: string;
  initialAmount?: number;
};

export function JupiterSwapModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  network,
  initialFromToken,
  initialToToken,
  initialAmount,
}: SwapModalProps) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [tokens, setTokens] = useState<any[]>([]);
  const [fromToken, setFromToken] = useState<any | null>(null);
  const [toToken, setToToken] = useState<any | null>(null);
  const [amount, setAmount] = useState(initialAmount?.toString() || "");
  const [slippageBps, setSlippageBps] = useState(100);
  const [loading, setLoading] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteData, setQuoteData] = useState<any | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadTokens() {
      try {
        const jupiterTokens = await getJupiterTokens(network);
        setTokens(jupiterTokens);

        if (initialFromToken) {
          const fromTokenInfo = jupiterTokens.find((t: any)=> 
            t.symbol.toUpperCase() === initialFromToken.toUpperCase()
          );
          if (fromTokenInfo) setFromToken(fromTokenInfo);
        }

        if (initialToToken) {
          const toTokenInfo = jupiterTokens.find((t: any)=> 
            t.symbol.toUpperCase() === initialToToken.toUpperCase()
          );
          if (toTokenInfo) setToToken(toTokenInfo);
        }
      } catch (err) {
        console.error("Failed to load tokens:", err);
        setError("Failed to load tokens");
      }
    }

    if (isOpen) {
      loadTokens();
    }
  }, [isOpen, network, initialFromToken, initialToToken]);

  useEffect(() => {
    async function updateQuote() {
      if(!fromToken || !toToken || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        setQuoteData(null);
        return;
      }

      setLoadingQuote(true);
      setError('');

      try {
        const amountInDecimals = parseFloat(amount) * Math.pow(10, fromToken.decimals)

        const quoteResponse = await getSwapRoutes(
          connection,
          fromToken.address,
          toToken.address,
          Math.floor(amountInDecimals),
          slippageBps,
          network,
        );

        if(quoteResponse) {
          setQuoteData(quoteResponse);
        } else {
          setError("No route found for this swap");
          setQuoteData(null);
        }
      } catch (err: any) {
        console.error("Error calculating quote:", err);
        setError(`Failed to calculate swap quote: ${err.message}`);
        setQuoteData(null);
      } finally {
        setLoadingQuote(false)
      }
    }
    
    if (fromToken && toToken && amount && parseFloat(amount) > 0) {
      const debounceTimer = setTimeout(()=> {
        updateQuote();
      }, 500);

      return () => clearTimeout(debounceTimer);
    }
  }, [fromToken, toToken, amount, slippageBps, connection, network]);


  const handleSwap = async () => {
    if (!fromToken || !toToken || !amount || isNaN(parseFloat(amount))) {
      setError("Please select tokens and enter an amount");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const amountInDecimals = parseFloat(amount) * Math.pow(10, fromToken.decimals);

      const result = await executeJupiterSwap(
        connection,
        wallet,
        fromToken.address,
        toToken.address,
        Math.floor(amountInDecimals),
        slippageBps,
        network
      );

      if(result.success) {
        onSuccess({
          ...result,
          fromTokenSymbol: fromToken.symbol,
          toTokenSymbol: toToken.symbol,
        });
        onClose();
      }else {
        setError(result.message || "Swap failed");
      }
    } catch (err: any) {
      console.error("Swap execution error:", err);
      setError(err.message || "An error occurred during swap");
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReverseTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setAmount('');
    setQuoteData(null);
  };


  const getPriceImpactColor = () => {
    if (!quoteData?.priceImpactPct) return "text-gray-500";
    const impact = parseFloat(quoteData.priceImpactPct) * 100;
    if (impact > 3) return "text-red-500";
    if (impact > 1) return "text-yellow-500";
    return "text-green-500";
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose} >
      <DialogContent className="sm:max-w-[425px]"> 
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Swap tokens
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
        {network === 'localnet' && (
          <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 p-3 rounded-md flex items-center space-x-2 mb-3">
            <span className="text-sm">
              ⚠️ You're on localnet which doesn't have liquidity pools. Swaps will use the devnet API.
              Consider switching to devnet or mainnet for real trading.
            </span>
          </div>
        )}
          <div className="space-y-2">
            <Label>From</Label>
            <div className="flex space-x-2">
              <Select
                value={fromToken?.address || ''}
                onValueChange={(value)=> {
                  const token = tokens.find(t => t.address === value)
                  setFromToken(token);
                }}
                disabled={loading || tokens.length === 0}
              >
                <SelectTrigger className="flex-grow">
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Select token</SelectItem>
                  {tokens.map(token => (
                    <SelectItem key={token.address} value={token.address}>
                      {token.symbol} - {token.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
                className="w-1/2"
                />
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size={"icon"}
              onClick={handleReverseTokens}
              disabled={!fromToken || !toToken || loading }
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label>To</Label>
            <div className="flex space-x-2">
              <Select
                value={toToken?.address || ''}
                onValueChange={(value)=> {
                  const token = tokens.find(t => t.address === value);
                  setToToken(token)
                }}
                disabled={loading || tokens.length === 0}
              >
                <SelectTrigger className="flex-grow">
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Select token</SelectItem>
                  {tokens
                    .filter(t => t.address !== fromToken?.address)
                    .map(token => (
                      <SelectItem key={token.address} value={token.address}>
                        {token.symbol} - {token.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

                <div className="w-1/2 bg-gray-100 dark:bg-gray-800 rounded p-2 flex items-center justify-center">
                  {loadingQuote ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  ) : quoteData ? (
                    <span className="text-sm font-mono">
                      {(parseFloat(quoteData.outAmount) / Math.pow(10, toToken.decimals || 9)).toFixed(6)}
                    </span>
                  ): (
                    <span className="text-sm text-gray-400">
                      Output Amount
                    </span>
                  )}
                </div>
              </div>
            </div>

            {quoteData && (
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Price</span>
                  <span>
                    1 {fromToken?.symbol} = {
                      (parseFloat(quoteData.outAmount) / parseFloat(quoteData.inAmount)).toFixed(6)
                    } {toToken?.symbol}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Price Impact</span>
                  <span className={getPriceImpactColor()}>
                    {(parseFloat(quoteData.priceImpactPct) * 100).toFixed(2)}%
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Minimum Received</span>
                  <span>
                    {(parseFloat(quoteData.outAmountWithSlippage) / Math.pow(10, toToken.decimals)).toFixed(6)} {toToken?.symbol}
                  </span>
                </div> 

                <div className="flex justify-between text-sm">
                  <span>Route</span>
                  <span className="text-xs">
                    {quoteData.routePlan.map((step: any, i: number) => (
                      <span key={i}>
                        {i > 0 && " → "}
                        {step.swapInfo.label || step.swapInfo.ammKey.slice(0,4)}
                      </span>
                    ))}
                  </span>
                </div> 
              </div>
            )}

            <div className="space-y-2">
              <Label>Slippage Tolerance</Label>
              <div className="flex space-x-2">
                {[0.1, 0.5, 1, 2].map(value => (
                  <Button
                    key={value}
                    type="button"
                    variant={slippageBps === value * 100 ? "default" : "outline"}
                    size={"sm"}
                    onClick={()=> setSlippageBps(value * 100)}
                    className="flex-1"
                    disabled={loading}
                  >
                    {value}%
                  </Button>
                ))}

                <div className="relative w-24">
                  <Input 
                    type="number"
                    min={"0.1"}
                    max={"10"}
                    step={"0.1"}
                    value={slippageBps / 100}
                    onChange={(e) => setSlippageBps(parseFloat(e.target.value) * 100)}
                    className="pr-7"
                    disabled={loading}
                  />
                  <div className="absolute inset-y-0 right-2 flex items-center">
                    <Percent className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
            {error && (
              <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 p-3 rounded-md flex items-center space-x-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

<Button
            onClick={handleSwap}
            disabled={loading || loadingQuote || !fromToken || !toToken || !amount || !quoteData}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>Swap</>
            )}
          </Button>
          </div>

      </DialogContent>

    </Dialog>
  )
}