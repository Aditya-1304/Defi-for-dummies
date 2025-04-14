// src/components/chat/chat-interface.tsx
"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { motion, AnimatePresence } from "framer-motion"
import { Ban, DatabaseZap, Send } from "lucide-react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { parsePaymentInstruction } from "@/services/nlp-service"
import { executePayment, mintTestTokens, getAllWalletBalances } from "@/services/solana-service"
import * as React from "react"
import type { JSX } from 'react'
import { Trash2 } from "lucide-react"
import { ArrowDownUp } from "lucide-react";
import { useRouter } from "next/navigation"
import dynamic from 'next/dynamic';
import { executeJupiterSwap, findTokenBySymbol } from "@/services/swap-service"; // <-- Add swap service functions

import { burnSpecificTokenAmount, burnTokensByMintAddress, cleanupUnwantedTokens, fetchUserTokens, saveTokenMappingsToLocalStorage } from "@/services/tokens-service"

// Lazy load heavy components
const NetworkSwitcher = dynamic(
  () => import('../(ui)/NetworkSwitcher').then(mod => ({ default: mod.NetworkSwitcher })),
  { ssr: false, loading: () => <div className="w-[120px] h-8 bg-gray-800 animate-pulse rounded" /> }
)

const WalletButton = dynamic(
  () => import('../wallet/wallet-button').then(mod => ({ default: mod.WalletButton })),
  { ssr: false, loading: () => <div className="h-8 w-[120px] bg-gray-800 animate-pulse rounded" /> }
)

interface Message {
  id: string
  content: string
  sender: "user" | "ai"
  timestamp: string
}

// Separate MessageComponent to improve rendering performance
const MessageComponent = React.memo(({ message, isClient, formatTime, MessageWithLinks }: { 
  message: Message,
  isClient: boolean,
  formatTime: (dateString: string) => string,
  MessageWithLinks: (text: string) => JSX.Element
}) => {
  return (
    <motion.div
      key={message.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`mb-4 flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`flex max-w-[80%] items-start gap-3 ${message.sender === "user" ? "flex-row-reverse" : ""}`}
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-800 dark:bg-gray-800 light:bg-gray-200">
          {message.sender === "ai" ? (
            <span className="text-sm font-semibold">AI</span>
          ) : (
            <span className="text-sm font-semibold">U</span>
          )}
        </div>
        <div
          className={`rounded-lg px-4 py-2 ${
            message.sender === "user"
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-600 dark:to-indigo-600 light:from-purple-500 light:to-indigo-500 text-white"
              : "bg-gradient-to-r from-gray-800 to-gray-700 dark:from-gray-800 dark:to-gray-700 light:from-gray-200 light:to-gray-100 dark:text-gray-100 light:text-gray-800"
          }`}
        >
          {MessageWithLinks(message.content)}
          {isClient && <p className="mt-1 text-xs opacity-70">{formatTime(message.timestamp)}</p>}
        </div>
      </div>
    </motion.div>
  );
});

// Input form component to isolate state changes
interface ChatInputFormProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  walletConnected: boolean;
}

const ChatInputForm = React.memo(({ onSendMessage, isLoading, walletConnected }: ChatInputFormProps) => {
  const [inputValue, setInputValue] = useState("");
  
  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue("");
  }, [inputValue, onSendMessage]);
  
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSend();
      }}
      className="flex gap-2"
    >
      <Input
        placeholder={walletConnected ? "Type 'send 10 USDC to address...'" : "Connect wallet to send payments..."}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="flex-1 bg-gray-800 dark:bg-gray-800 light:bg-white border-gray-700 dark:border-gray-700 light:border-gray-300 text-gray-100 dark:text-gray-100 light:text-gray-800 placeholder:text-gray-500"
      />
      <Button
        type="submit"
        size="icon"
        disabled={isLoading}
        className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-600 dark:to-indigo-600 light:from-purple-500 light:to-indigo-500 hover:from-purple-700 hover:to-indigo-700"
      >
        <Send className="h-4 w-4" />
        <span className="sr-only">Send message</span>
      </Button>
    </form>
  );
});

export function ChatInterface() {
  const { connection } = useConnection()
  const router = useRouter();
  const wallet = useWallet()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const networkOptions = ["localnet", "devnet", "mainnet"] as const
  const [network, setNetwork] = useState<"localnet" | "devnet" | "mainnet">(networkOptions[0])

  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isClient, setIsClient] = useState(false)
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapParams, setSwapParams] = useState({
    fromToken:'',
    toToken: '',
    amount: 0
  })

  const memoizedMessages = useMemo(() => messages, [messages])
  // Set isClient to true when component mounts on client side
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const networkParam = params.get("network")
    const currentNetwork = networkParam === "devnet" || networkParam === "mainnet" ? networkParam : "localnet"

    setNetwork(currentNetwork as "localnet" | "devnet" | "mainnet")

    if (typeof window !== 'undefined') {
      const storedMessages = localStorage.getItem(`chat_messages_${currentNetwork}`)
      
      if (storedMessages) {
        try {
          const parsedMessages = JSON.parse(storedMessages)
          setMessages(parsedMessages)
        } catch (e) {
          console.error("Error parsing stored messages:", e)
          // If parsing fails, set default welcome message
          setDefaultWelcomeMessage(currentNetwork)
        }
      } else {
        // No stored messages, set default welcome message
        setDefaultWelcomeMessage(currentNetwork)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem(`chat_messages_${network}`, JSON.stringify(messages))
    }
  }, [messages, network])

  const setDefaultWelcomeMessage = (currentNetwork: string) => {
    setMessages([
      {
        id: "initial-message",
        content: `Hello! I'm your DeFi companion on ${currentNetwork}. How can I help you today?`,
        sender: "ai",
        timestamp: new Date().toISOString(),
      },
    ])
  };

  const navigateToSwap = () => {
    // Get the current network from URL to maintain it in the swap page
    const params = new URLSearchParams(window.location.search);
    const networkParam = params.get("network") || "localnet";
    router.push(`/swap?network=${networkParam}`);
  };

  const handleSwapSuccess = (result:any) => {
    addAIMessage(
      `✅ Successfully swapped ${result.inputAmount?.toFixed(6) || ''} ${result.fromTokenSymbol} for ${result.outputAmount?.toFixed(6) || ''} ${result.toTokenSymbol}.\n\n` +
      `View transaction in [Solana Explorer](${result.explorerUrl})`
    )
  }

  const handleSwapError = (error: any) => {
    console.error("Swap error:", error);
    addAIMessage(`❌ Swap failed: ${error.message || "Unknown error"}`)
  }

  const clearTokenCache = () => {
    try {
      // Clear token mappings for all networks
      localStorage.removeItem('token-mappings-localnet');
      localStorage.removeItem('token-mappings-devnet');
      localStorage.removeItem('token-mappings-mainnet');
      
      // Clear any old format keys that might exist
      localStorage.removeItem('token-mapping-localnet');
      localStorage.removeItem('token-mapping-devnet');
      localStorage.removeItem('token-mapping-mainnet');
      
      addAIMessage("✅ Token cache cleared successfully. All tokens will display as Unknown until you run 'fix tokens' again.");
    } catch (error: any) {
      addAIMessage(`❌ Error clearing token cache: ${error.message}`);
    }
  }
  const getExplorerLink = (signature: string, network: string) => {
    return network === "mainnet"
      ? `https://explorer.solana.com/tx/${signature}`
      : `https://explorer.solana.com/tx/${signature}?cluster=${network}`;
  };
  const handleCleanupAllTokens = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      addAIMessage("Please connect your wallet to clean up tokens.");
      return;
    }
    
    // Show confirmation dialog
    if (!confirm("This will remove ALL tokens from your wallet (except SOL). Continue?")) {
      return;
    }
    
    const params = new URLSearchParams(window.location.search);
    const urlNetwork = params.get("network");
    const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet";
    
    addAIMessage(`Cleaning up ALL tokens on ${effectiveNetwork}...`);
    setIsLoading(true);
    
    try {
      const result = await cleanupUnwantedTokens(
        connection,
        wallet,
        "all", // Target all tokens except SOL
        effectiveNetwork as "localnet" | "devnet" | "mainnet",
        true // Burn tokens before closing accounts
      );
      if (result.success) {
        if (result.removedTokens === 0) {
          addAIMessage(`No tokens found to clean up.`);
        } else {
          if ('signature' in result && result.signature) {
            const explorerUrl = getExplorerLink(result.signature as string, effectiveNetwork);
            addAIMessage(`✅ ${result.message}\n\nView transaction in [Solana Explorer](${explorerUrl})`);
          } else {
            addAIMessage(`✅ ${result.message}`);
          }
        }
      } else {
        addAIMessage(`❌ ${result.message}`);
      }
    } catch (error: any) {
      addAIMessage(`❌ Error cleaning up tokens: ${error.message}`);
    }
    
    setIsLoading(false);
  };

  const handleNewChat = () => {
    // Clear messages in state
    const welcomeMessage = {
      id: `welcome-${Date.now()}`,
      content: `Starting a new conversation on ${network}. How can I help you today?`,
      sender: "ai" as const,
      timestamp: new Date().toISOString(),
    };
    
    setMessages([welcomeMessage]);
    
    // Clear stored messages for current network
    if (typeof window !== 'undefined') {
      localStorage.setItem(`chat_messages_${network}`, JSON.stringify([welcomeMessage]));
    }
  }

  const addAIMessage = useCallback((content: string) => {
    // The regex here had the same issue with $$ instead of \( and \)
    const formattedContent = content.replace(
      /View in \[Solana Explorer\]\((https:\/\/explorer\.solana\.com\/[^)]+)\)/g,
      "View in [Solana Explorer]($1)"
    );
  
    const aiMessage: Message = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      content: formattedContent, 
      sender: "ai",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, aiMessage]);
  }, []);

  // Handle input message submission
  const handleInputSend = useCallback(async (userInput: string) => {
    if (!userInput.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      content: userInput,
      sender: "user",
      timestamp: new Date().toISOString(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    
    try {
      // Process with NLP
      const parsedInstruction = await parsePaymentInstruction(userInput)

      console.log("Parsed instruction:", parsedInstruction)

      if (parsedInstruction.isBalanceCheck || parsedInstruction.isPayment || parsedInstruction.isMintRequest || parsedInstruction.isSwapRequest ) {
        const userInputLower = userInput.toLowerCase();
        let requestedNetwork: "localnet" | "devnet" | "mainnet" | null = null;

        if (userInputLower.includes("devnet")) requestedNetwork = "devnet";
        else if (userInputLower.includes("mainnet")) requestedNetwork = "mainnet";
        else if (userInputLower.includes("localnet") || userInputLower.includes("local")) requestedNetwork = "localnet";

        if (requestedNetwork && requestedNetwork !== network) {
          addAIMessage(`To perform this action on ${requestedNetwork}, I need to switch networks. Redirecting...`);
          setTimeout(() => {
            window.location.href = `/chat?network=${requestedNetwork}`;
          }, 1500);
          setIsLoading(false);
          return; // Stop processing if network switch is needed
        }
      }

      const params = new URLSearchParams(window.location.search);
      const urlNetwork = params.get("network");
      const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet";
      
      if (parsedInstruction.isSwapRequest) {
        console.log("Handling as SWAP request:", parsedInstruction);
        if (!wallet.connected || !wallet.publicKey) {
          addAIMessage("Please connect your wallet to swap tokens.");
        } else {
          const fromTokenSymbol = parsedInstruction.fromToken ; // Default or extracted
          const toTokenSymbol = parsedInstruction.toToken  ;   // Default or extracted
          const amount = parsedInstruction.amount ;         // Default or extracted

          if(!fromTokenSymbol || !toTokenSymbol || !amount || amount <= 0) {
            
          }
        }
        setIsLoading(false);
        return; // Stop further processing
      }

      // if (parsedInstruction.isBalanceCheck) {
      //   setIsLoading(true);
        
      //   try {
      //     if (!wallet.connected || !wallet.publicKey) {
      //       addAIMessage("Please connect your wallet to check your balance.");
      //       setIsLoading(false);
      //       return;
      //     }
          
      //     // Use the same URL params for network consistency
      //     const params = new URLSearchParams(window.location.search);
      //     const urlNetwork = params.get("network");
      //     const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet";
          
      //     addAIMessage(`Checking all your token balances on ${effectiveNetwork}...`);
          
      //     // Use the same fetchUserTokens function as the list all tokens command
      //     const tokens = await fetchUserTokens(
      //       connection, 
      //       wallet.publicKey, 
      //       effectiveNetwork as "localnet" | "devnet" | "mainnet"
      //     );
          
      //     if (tokens.length === 0) {
      //       addAIMessage(`💰 Your ${effectiveNetwork} wallet has no tokens`);
      //       setIsLoading(false);
      //       return;
      //     }
          
      //     // Format response similarly to how list all tokens works
      //     const tokensList = tokens.map(token => 
      //       `• ${token.balance.toFixed(token.decimals === 9 ? 7 : 2)} ${token.symbol}`
      //     );
          
      //     addAIMessage(`💰 Your ${effectiveNetwork} wallet balances:\n${tokensList.join('\n')}`);
      //   } catch (error: any) {
      //     console.error("Balance check error:", error);
      //     addAIMessage(`Error checking balance: ${error.message}`);
      //   }
      //   setIsLoading(false);
      //   return;
      // }
      else if (parsedInstruction.isBalanceCheck || parsedInstruction.listAllTokens) {
        console.log("Handling as BALANCE/LIST request:", parsedInstruction);
        if (!wallet.connected || !wallet.publicKey) {
          addAIMessage("Please connect your wallet to check balances or list tokens.");
        } else {
          const hideUnknown = !parsedInstruction.listAllTokens; // Only hide if it's a simple balance check
          addAIMessage(`Checking your token balances on ${effectiveNetwork}...`);
          try {
            const tokens = await fetchUserTokens(
              connection,
              wallet.publicKey,
              effectiveNetwork as "localnet" | "devnet" | "mainnet",
              { hideUnknown } // Pass option based on command type
            );

            if (tokens.length === 0) {
              addAIMessage(`💰 Your ${effectiveNetwork} wallet has no ${hideUnknown ? 'known' : ''} tokens.`);
            } else {
              const tokensList = tokens.map(token => {
                const balanceStr = token.balance.toFixed(token.decimals === 9 ? 7 : 2);
                if (token.symbol === "SOL") {
                  return `• ${balanceStr} ${token.symbol}`;
                }
                // Include mint address if listing all or if symbol is unknown
                const mintInfo = (!hideUnknown || token.symbol === 'Unknown') ? `\n  Mint: \`${token.mint}\`` : '';
                return `• ${balanceStr} ${token.symbol}${mintInfo}`;
              });
              let response = `💰 Your ${effectiveNetwork} wallet balances:\n${tokensList.join('\n')}`;
              if (!hideUnknown) {
                response += `\n\nTo burn a token, copy its mint address and type: \`burn 10 from mint PASTE_ADDRESS_HERE\``;
              }
              addAIMessage(response);
            }
          } catch (error: any) {
            console.error("Balance/List check error:", error);
            addAIMessage(`Error checking balance/listing tokens: ${error.message}`);
          }
        }
        setIsLoading(false);
        return;
     }

      // In your handleSend function in chat-interface.tsx, add handling for mint requests
      // if (parsedInstruction.isMintRequest) {
      //   if (!wallet.connected) {
      //     addAIMessage("Please connect your wallet to mint tokens.");
      //     setIsLoading(false);
      //     return;
      //   }
      //   console.log("Mint request detected with parsed instruction:", parsedInstruction);
  
      //   const token = parsedInstruction.token || "USDC";
      //   const amount = parsedInstruction.amount !== null ? parsedInstruction.amount : 100;
        
        
      //   const params = new URLSearchParams(window.location.search);
      //   const urlNetwork = params.get("network");
      //   const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet";
        
      //   console.log(`About to mint ${amount} ${token} tokens on ${effectiveNetwork}`);
      //   addAIMessage(`Minting ${amount} ${token} tokens on ${effectiveNetwork}...`);
        
      //   const result = await mintTestTokens(
      //     connection,
      //     wallet,
      //     token,
      //     amount,
      //     effectiveNetwork as "localnet" | "devnet" | "mainnet"
      //   );
        
      //   if (result.success) {
      //             if (result.signature && typeof result.signature === 'string') {
      //               const signature = result.signature as string;
      //               const explorerUrl = getExplorerLink(signature, effectiveNetwork);
      //               addAIMessage(`✅ ${result.message}\n\nView in [Solana Explorer](${explorerUrl})`);
      //     } else {
      //       addAIMessage(`✅ ${result.message}`);
      //     }
      //   } else {
      //     addAIMessage(`❌ ${result.message}`);
      //   }            
        
      //   setIsLoading(false);
      //   return;
      // }
      else if (parsedInstruction.isMintRequest) {
        console.log("Handling as MINT request:", parsedInstruction);
        if (!wallet.connected) {
          addAIMessage("Please connect your wallet to mint tokens.");
        } else {
          const token = parsedInstruction.token || "USDC"; // Default or extracted
          const amount = parsedInstruction.amount ?? 100; // Default or extracted (use ?? for 0 amount)

          console.log(`About to mint ${amount} ${token} tokens on ${effectiveNetwork}`);
          addAIMessage(`Minting ${amount} ${token} tokens on ${effectiveNetwork}...`);
          try {
            const result = await mintTestTokens(
              connection, wallet, token, amount, effectiveNetwork as "localnet" | "devnet" | "mainnet"
            );
            if (result.success) {
              const explorerUrl = result.signature ? getExplorerLink(result.signature, effectiveNetwork) : null;
              addAIMessage(`✅ ${result.message}${explorerUrl ? `\n\nView in [Solana Explorer](${explorerUrl})` : ''}`);
            } else {
              addAIMessage(`❌ ${result.message}`);
            }
          } catch (error: any) {
             console.error("Mint error:", error);
             addAIMessage(`❌ Failed to mint tokens: ${error.message}`);
          }
        }
        setIsLoading(false);
        return;
      }

      // if (parsedInstruction.isSwapRequest) {
      //   if(!wallet.connected) {
      //     addAIMessage("Please connect your wallet to swap tokens.")
      //     setIsLoading(false)
      //     return
      //   }

      //   const params = new URLSearchParams(window.location.search)
      //   const urlNetwork = params.get("network")
      //   const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet";

      //   const fromToken = parsedInstruction.fromToken || "SOL";
      //   const toToken = parsedInstruction.toToken || "USDC";
      //   const amount = parsedInstruction.amount || 1;

      //   if (fromToken && toToken) {
      //     addAIMessage(`Opening swap interface to swap ${amount} ${fromToken} for ${toToken}...`)

      //     setSwapParams({
      //       fromToken,
      //       toToken,
      //       amount
      //     });

      //     setIsSwapModalOpen(true);
      //   }else {
      //     addAIMessage("Opening the token swap interface...")
      //     setIsSwapModalOpen(true);
      //   }

      //   setIsLoading(false);
      //   return;
      // }

      // if (parsedInstruction.isTokenCleanup) {
      //   if (!wallet.connected) {
      //     addAIMessage("Please connect your wallet to clean up tokens.");
      //     setIsLoading(false);
      //     return;
      //   }
      
      //   const params = new URLSearchParams(window.location.search);
      //   const urlNetwork = params.get("network");
      //   const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet";
        
      //   const target = parsedInstruction.cleanupTarget || "unknown";
      //   const shouldBurn = parsedInstruction.burnTokens || false;
        
      //   // Update the message based on action
      //   if (shouldBurn) {
      //     if (target === "unknown") {
      //       addAIMessage(`Burning and cleaning up unknown tokens on ${effectiveNetwork}...`);
      //     } else if (Array.isArray(target)) {
      //       addAIMessage(`Burning and cleaning up ${target.join(', ')} tokens on ${effectiveNetwork}...`);
      //     }
      //   } else {
      //     if (target === "unknown") {
      //       addAIMessage(`Cleaning up unknown tokens on ${effectiveNetwork}...`);
      //     } else if (Array.isArray(target)) {
      //       addAIMessage(`Cleaning up ${target.join(', ')} tokens on ${effectiveNetwork}...`);
      //     }
      //   }
        
      //   try {
      //     const result = await cleanupUnwantedTokens(
      //       connection,
      //       wallet,
      //       target,
      //       effectiveNetwork as "localnet" | "devnet" | "mainnet",
      //       shouldBurn // Pass the burn flag
      //     );
          
      //     if (result.success) {
      //       if (result.removedTokens === 0) {
      //         addAIMessage(`No eligible token accounts found to clean up.`);
      //       } else if ('signature' in result && result.signature && typeof result.signature === 'string') {
      //         const explorerUrl = getExplorerLink(result.signature as string, effectiveNetwork);
      //         addAIMessage(`✅ ${result.message}\n\nView transaction in [Solana Explorer](${explorerUrl})`);
      //       } else {
      //         addAIMessage(`✅ ${result.message}`);
      //       }
      //     } else {
      //       addAIMessage(`❌ ${result.message}`);
      //     }
      //   } catch (error: any) {
      //     console.error("Token cleanup error:", error);
      //     addAIMessage(`❌ Failed to clean up tokens: ${error.message}`);
      //   }
        
      //   setIsLoading(false);
      //   return;
      // }

      else if (parsedInstruction.isTokenCleanup) {
        console.log("Handling as CLEANUP request:", parsedInstruction);
        if (!wallet.connected || !wallet.publicKey) {
          addAIMessage("Please connect your wallet to clean up tokens.");
        } else {
          const target = parsedInstruction.cleanupTarget || "unknown";
          const shouldBurn = parsedInstruction.burnTokens || false; // Check if burn was requested

          // Confirmation for "all" target
          if (target === "all") {
             if (!confirm("This will remove ALL tokens from your wallet (except SOL). Are you sure?")) {
               addAIMessage("Token cleanup cancelled.");
               setIsLoading(false);
               return;
             }
             addAIMessage(`Cleaning up ALL tokens on ${effectiveNetwork}...`);
          } else {
             const targetDesc = target === "unknown" ? "unknown" : target.join(', ');
             addAIMessage(`${shouldBurn ? 'Burning and cleaning' : 'Cleaning'} up ${targetDesc} tokens on ${effectiveNetwork}...`);
          }

          try {
            const result = await cleanupUnwantedTokens(
              connection, wallet, target, effectiveNetwork as "localnet" | "devnet" | "mainnet", shouldBurn
            );
            if (result.success) {
              if (result.removedTokens === 0 && (!result.burnedTokens || Object.keys(result.burnedTokens).length === 0)) {
                 addAIMessage(`No eligible token accounts found to clean up.`);
               } else {
                  const explorerUrl = result.signatures?.[0] ? getExplorerLink(result.signatures[0], effectiveNetwork) : null;
                  addAIMessage(`✅ ${result.message}${explorerUrl ? `\n\nView transaction in [Solana Explorer](${explorerUrl})` : ''}`);
               }
             } else {
              addAIMessage(`❌ ${result.message}`);
            }
          } catch (error: any) {
            console.error("Token cleanup error:", error);
            addAIMessage(`❌ Failed to clean up tokens: ${error.message}`);
          }
        }
        setIsLoading(false);
        return;
      }

      // if (parsedInstruction.burnSpecificAmount) {
      //   if (!wallet.connected) {
      //     addAIMessage("Please connect your wallet to burn tokens.");
      //     setIsLoading(false);
      //     return;
      //   }
      
      //   const params = new URLSearchParams(window.location.search);
      //   const urlNetwork = params.get("network");
      //   const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet";
        
      //   const token = parsedInstruction.token || "USDC";
      //   const amount = parsedInstruction.burnAmount || 0;
        
      //   addAIMessage(`Burning ${amount} ${token} tokens on ${effectiveNetwork}...`);
        
      //   try {
      //     const result = await burnSpecificTokenAmount(
      //       connection,
      //       wallet,
      //       token,
      //       amount,
      //       effectiveNetwork as "localnet" | "devnet" | "mainnet",
      //       true
      //     );
          
      //     if (result.success) {
      //       if (result.signature) {
      //         // Create a Solana explorer link for the transaction
      //         const explorerUrl = effectiveNetwork === "mainnet" 
      //           ? `https://explorer.solana.com/tx/${result.signature}` 
      //           : `https://explorer.solana.com/tx/${result.signature}?cluster=${effectiveNetwork}`;
                
      //         addAIMessage(`✅ ${result.message} [View on Explorer](${explorerUrl})`);
      //       } else {
      //         addAIMessage(`✅ ${result.message}`);
      //       }
      //     } else {
      //       if (result.signature) {
      //         const explorerUrl = effectiveNetwork === "mainnet" 
      //           ? `https://explorer.solana.com/tx/${result.signature}` 
      //           : `https://explorer.solana.com/tx/${result.signature}?cluster=${effectiveNetwork}`;
                
      //         addAIMessage(`❌ ${result.message} [Check status](${explorerUrl})`);
      //       } else {
      //         addAIMessage(`❌ ${result.message}`);
      //       }
      //     }
      //   } catch (error: any) {
      //     console.error("Specific burn error:", error);
          
      //     // Try to extract signature from error if possible
      //     const signatureMatch = error.message?.match(/signature\s([A-Za-z0-9]+)/);
      //     const signature = signatureMatch ? signatureMatch[1] : null;
          
      //     if (signature) {
      //       const explorerUrl = effectiveNetwork === "mainnet" 
      //         ? `https://explorer.solana.com/tx/${signature}` 
      //         : `https://explorer.solana.com/tx/${signature}?cluster=${effectiveNetwork}`;
              
      //       addAIMessage(`⚠️ Transaction sent but confirmation timed out. [Check status on explorer](${explorerUrl})`);
      //     } else {
      //       addAIMessage(`❌ Failed to burn tokens: ${error.message}`);
      //     }
      //   }
        
      //   setIsLoading(false);
      //   return;
      // }

      else if (parsedInstruction.burnSpecificAmount) {
        console.log("Handling as BURN Specific Amount request:", parsedInstruction);
        if (!wallet.connected) {
          addAIMessage("Please connect your wallet to burn tokens.");
        } else {
          const token = parsedInstruction.token || "Unknown"; // Need a token symbol
          const amount = parsedInstruction.burnAmount || 0;

          if (token === "Unknown" || amount <= 0) {
             addAIMessage("Please specify the token symbol and amount to burn (e.g., 'burn 10 USDC').");
          } else {
             addAIMessage(`Burning ${amount} ${token} tokens on ${effectiveNetwork}...`);
             try {
                const result = await burnSpecificTokenAmount(
                  connection, wallet, token, amount, effectiveNetwork as "localnet" | "devnet" | "mainnet", true // Close account if empty
                );
                if (result.success) {
                  const explorerUrl = result.signature ? getExplorerLink(result.signature, effectiveNetwork) : null;
                  addAIMessage(`✅ ${result.message}${explorerUrl ? ` [View on Explorer](${explorerUrl})` : ''}`);
                } else {
                  const explorerUrl = result.signature ? getExplorerLink(result.signature, effectiveNetwork) : null;
                  addAIMessage(`❌ ${result.message}${explorerUrl ? ` [Check status](${explorerUrl})` : ''}`);
                }
             } catch (error: any) {
                console.error("Specific burn error:", error);
                addAIMessage(`❌ Failed to burn tokens: ${error.message}`);
             }
          }
        }
        setIsLoading(false);
        return;
     }
     else if (parsedInstruction.burnByMintAddress) {
      console.log("Handling as BURN By Mint Address request:", parsedInstruction);
      if (!wallet.connected) {
        addAIMessage("Please connect your wallet to burn tokens.");
      } else {
        const mintAddress = parsedInstruction.mintAddress;
        const amount = parsedInstruction.amount || parsedInstruction.burnAmount || 0;

        if (!mintAddress || mintAddress.includes('...') || amount <= 0) {
          addAIMessage("❌ Please provide the complete mint address and a valid amount (e.g., 'burn 10 from mint ADDRESS'). Use `list all tokens` to find mint addresses.");
        } else {
          addAIMessage(`Burning ${amount} tokens from mint ${mintAddress.substring(0, 8)}... on ${effectiveNetwork}...`);
          try {
            const result = await burnTokensByMintAddress(
              connection, wallet, mintAddress, amount, effectiveNetwork as "localnet" | "devnet" | "mainnet", true // Close account if empty
            );
            if (result.success) {
              addAIMessage(`✅ ${result.message}`);
              // Consider refreshing balances here if needed
            } else {
              const explorerUrl = result.signature ? getExplorerLink(result.signature, effectiveNetwork) : null;
              addAIMessage(`❌ ${result.message}${explorerUrl ? `\n\nCheck details in [Solana Explorer](${explorerUrl})` : ''}`);
            }
          } catch (error: any) {
            console.error("Error burning tokens by mint:", error);
            if (error.message.includes("Non-base58 character")) {
              addAIMessage("❌ Invalid mint address format. Please use the complete address.");
            } else {
              addAIMessage(`❌ Error burning tokens: ${error.message}`);
            }
          }
        }
      }
      setIsLoading(false);
      return;
   }

   else if (parsedInstruction.isFixTokenNames) {
    console.log("Handling as FIX Token Names request:", parsedInstruction);
    try {
      // Define known token mappings (Consider moving this to a config/service file)
      const knownMappings: Record<string, string> = {
        'localnet': JSON.stringify({
          '2P7oDTkYMY9Jq5vt5tPT3QE1eKNcoBbrACWKoBwa3UYb': 'NIX',
          'Ak8exWsropfAVNgP2SFMPMbeyU5brX8oZvgqKj9xHeaZ': 'USDC',
          'BwLTw16weBeEGEbRxCFHgxERHsepMWVtLv5sfNnVopro': 'BONK',
        }),
        'devnet': JSON.stringify({ // Add Devnet mappings if needed
           'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr': 'USDC', // Example Devnet USDC
           // ... other devnet tokens
        }),
        'mainnet': JSON.stringify({ // Add Mainnet mappings if needed
           'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC', // Example Mainnet USDC
           // ... other mainnet tokens
        }),
      };

      const mappingsToApply = JSON.parse(knownMappings[effectiveNetwork] || '{}');

      if (Object.keys(mappingsToApply).length === 0) {
         addAIMessage(`⚠️ No known token mappings defined for ${effectiveNetwork}.`);
      } else {
         for (const [mintAddress, symbol] of Object.entries(mappingsToApply)) {
           saveTokenMappingsToLocalStorage(symbol as string, mintAddress, effectiveNetwork);
         }
         addAIMessage(`✅ Applied known token name mappings for ${effectiveNetwork}. Check your balance again.`);
      }
    } catch (error: any) {
      addAIMessage(`Failed to fix token names: ${error.message}`);
    }
    setIsLoading(false);
    return;
 }


 else if (parsedInstruction.isPayment) {
  console.log("Handling as PAYMENT request:", parsedInstruction);
  if (!wallet.connected) {
    addAIMessage("Please connect your wallet to make this payment.");
  } else if (!parsedInstruction.recipient || !parsedInstruction.amount || !parsedInstruction.token) {
    addAIMessage("I need a complete payment instruction with amount, token, and recipient address (e.g., 'send 0.1 SOL to ADDRESS').");
  } else if (parsedInstruction.confidence < 0.6) { // Confidence check
     addAIMessage("I'm not completely sure about those payment details. Could you please provide the amount, token, and recipient address more clearly?");
  } else {
    addAIMessage(`I'll help you send ${parsedInstruction.amount} ${parsedInstruction.token} to ${parsedInstruction.recipient} on ${effectiveNetwork}. Please confirm this transaction.`);
    try {
      const result = await executePayment(
        connection, wallet, parsedInstruction.recipient!, parsedInstruction.amount!, parsedInstruction.token, effectiveNetwork as "localnet" | "devnet" | "mainnet"
      );
      if (result && result.success) {
        addAIMessage(`✅ ${result.message}\n\nTransaction ID: ${result.signature}\n\nView in [Solana Explorer](${result.explorerUrl})`);
      } else {
        addAIMessage(`❌ Transaction failed: ${result?.message || 'Unknown error'}\n\nError details: ${result?.error || 'No details available'}`);
        console.error("Transaction failure details:", result);
      }
    } catch (error: any) {
       console.error("Payment execution error:", error);
       addAIMessage(`❌ Transaction error: ${error.message}`);
    }
  }
  setIsLoading(false);
  return;
}

     
      // if (parsedInstruction.listAllTokens) {
      //   if (!wallet.connected || !wallet.publicKey) {
      //     addAIMessage("Please connect your wallet to list tokens.");
      //     setIsLoading(false);
      //     return;
      //   }
        
      //   const params = new URLSearchParams(window.location.search);
      //   const urlNetwork = params.get("network");
      //   const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet";
        
      //   setIsLoading(true);
      //   try {
      //     const tokens = await fetchUserTokens(
      //       connection, 
      //       wallet.publicKey, 
      //       effectiveNetwork as "localnet" | "devnet" | "mainnet",
      //       { hideUnknown: false }
      //     );
          
      //     if (tokens.length === 0) {
      //       addAIMessage("You don't have any tokens in your wallet.");
      //     } else {
      //       // Format tokens with full mint addresses for burning
      //       const tokenList = tokens.map(t => {
      //         // Special handling for SOL which doesn't have a real mint address
      //         if (t.symbol === "SOL") {
      //           return `• ${t.balance.toFixed(t.decimals === 9 ? 7 : 2)} ${t.symbol}`;
      //         }
      //         // For all other tokens, include the full mint address
      //         return `• ${t.balance.toFixed(t.decimals === 9 ? 7 : 2)} ${t.symbol}\n  Mint: \`${t.mint}\``;
      //       });
            
      //       addAIMessage(`Your token balances on ${effectiveNetwork}:\n${tokenList.join('\n')}\n\nTo burn a token, copy its mint address and type: \`burn 10 from mint PASTE_ADDRESS_HERE\``);
      //     }
      //   } catch (error: any) {
      //     addAIMessage(`Error listing tokens: ${error.message}`);
      //   }
      //   setIsLoading(false);
      //   return;
      // }
      
      // if (parsedInstruction.burnByMintAddress) {
      //   if (!wallet.connected) {
      //     addAIMessage("Please connect your wallet to burn tokens.");
      //     setIsLoading(false);
      //     return;
      //   }
      
      //   setIsLoading(true);
        
      //   const mintAddress = parsedInstruction.mintAddress;
      //   const amount = parsedInstruction.amount || parsedInstruction.burnAmount || 0;
        
      //   // Validate the mint address format
      //   if (!mintAddress || mintAddress.includes('...')) {
      //     addAIMessage("❌ Please provide the complete mint address. Use the `list all tokens` command to see your tokens with full mint addresses.");
      //     setIsLoading(false);
      //     return;
      //   }
        
      //   try {
      //     const params = new URLSearchParams(window.location.search);
      //     const urlNetwork = params.get("network");
      //     const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet";
          
      //     addAIMessage(`Burning ${amount} tokens from mint address ${mintAddress.substring(0, 8)}... on ${effectiveNetwork}...`);
          
      //     const result = await burnTokensByMintAddress(
      //       connection,
      //       wallet,
      //       mintAddress,
      //       amount,
      //       effectiveNetwork as "localnet" | "devnet" | "mainnet",
      //       true // Close account if empty
      //     );
          
      //     if (result.success) {
      //       addAIMessage(`✅ ${result.message}`);
            
      //       // Refresh balances after successful burn
      //       await getAllWalletBalances(
      //         connection, 
      //         wallet, 
      //         effectiveNetwork as "localnet" | "devnet" | "mainnet",
      //         { initialOnly: false }
      //       );
      //     } else {
      //       if ('signature' in result && result.signature && typeof result.signature === 'string') {
      //         const explorerUrl = getExplorerLink(result.signature, effectiveNetwork);
      //         addAIMessage(`❌ ${result.message}\n\nCheck details in [Solana Explorer](${explorerUrl})`);
      //       } else {
      //         addAIMessage(`❌ ${result.message}`);
      //       }
      //     }
      //   } catch (error: any) {
      //     console.error("Error burning tokens:", error);
          
      //     // Provide more helpful error messages
      //     if (error.message.includes("Non-base58 character")) {
      //       addAIMessage("❌ Invalid mint address format. Please use the complete address without any '...' at the end.");
      //     } else {
      //       addAIMessage(`❌ Error burning tokens: ${error.message}`);
      //     }
      //   }
      //   setIsLoading(false);
      //   return;
      // }

      // if (parsedInstruction.isFixTokenNames) {
      //   setIsLoading(true);
      //   try {
      //     // Get network from URL parameters
      //     const params = new URLSearchParams(window.location.search);
      //     const urlNetwork = params.get("network");
      //     const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet";
          
      //     // Define known token mappings
      //     const knownMappings = {
      //       '2P7oDTkYMY9Jq5vt5tPT3QE1eKNcoBbrACWKoBwa3UYb': 'NIX',
      //       'Ak8exWsropfAVNgP2SFMPMbeyU5brX8oZvgqKj9xHeaZ': 'USDC', // Add your USDC mint
      //       'BwLTw16weBeEGEbRxCFHgxERHsepMWVtLv5sfNnVopro': 'BONK', // Looks like this is your BONK mint
      //       // Add more as needed
      //     };
          
      //     // Apply the mappings
      //     for (const [mintAddress, symbol] of Object.entries(knownMappings)) {
      //       saveTokenMappingsToLocalStorage(symbol, mintAddress, effectiveNetwork);
      //     }
          
      //     addAIMessage("✅ Fixed token names in your wallet. Please check your balance again.");
      //   } catch (error: any) {
      //     addAIMessage(`Failed to fix token names: ${error.message}`);
      //   }
      //   setIsLoading(false);
      //   return;
      // }
      // if (parsedInstruction.isTokenCleanup && parsedInstruction.cleanupTarget === "all") {
      //   setIsLoading(true);
      //   try {
      //     if (!wallet.connected || !wallet.publicKey) {
      //       addAIMessage("Please connect your wallet to clean up tokens.");
      //       setIsLoading(false);
      //       return;
      //     }
          
      //     // Get network parameter from URL
      //     const params = new URLSearchParams(window.location.search);
      //     const urlNetwork = params.get("network");
      //     const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet";
          
      //     addAIMessage(`Cleaning up ALL tokens on ${effectiveNetwork}...`);
          
      //     const result = await cleanupUnwantedTokens(
      //       connection, 
      //       wallet,
      //       "all", // Use "all" to clean up all tokens
      //       effectiveNetwork as "localnet" | "devnet" | "mainnet",
      //       true // Burn tokens first
      //     );
          
      //     if (result.success) {
      //       if (result.removedTokens === 0 && (!result.burnedTokens || Object.keys(result.burnedTokens).length === 0)) {
      //         addAIMessage("No tokens found to clean up.");
      //       } else {
      //         addAIMessage(`✅ ${result.message}`);
      //       }
      //     } else {
      //       addAIMessage(`❌ ${result.message}`);
      //     }
      //   } catch (error: any) {
      //     console.error("Token cleanup error:", error);
      //     addAIMessage(`Error cleaning up tokens: ${error.message}`);
      //   }
      //   setIsLoading(false);
      //   return;
      // }
      // Handle Gemini payment requests
      
      // Lower the confidence threshold for Gemini
      // if (parsedInstruction.isPayment && parsedInstruction.confidence > 0.5) {
      //   // Check for missing required fields
      //   if (!parsedInstruction.recipient || !parsedInstruction.amount || !parsedInstruction.token) {
      //     addAIMessage(
      //       "I need a complete payment instruction with amount, token, and recipient address. For example: 'send 0.1 SOL to address'",
      //     )
      //     setIsLoading(false)
      //     return
      //   }

      //   // Check wallet connection
      //   if (!wallet.connected) {
      //     addAIMessage("Please connect your wallet to make this payment.")
      //     setIsLoading(false)
      //     return
      //   }

      //   const params = new URLSearchParams(window.location.search)
      //   const urlNetwork = params.get("network")
      //   const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet"

      //   console.log(`Using network from URL: ${effectiveNetwork}`)

      //   // Request payment confirmation with correct network
      //   addAIMessage(
      //     `I'll help you send ${parsedInstruction.amount} ${parsedInstruction.token} to ${parsedInstruction.recipient} on ${effectiveNetwork}. Please confirm this transaction.`,
      //   )

      //   // Execute payment using the network from URL
      //   const result = await executePayment(
      //     connection,
      //     wallet,
      //     parsedInstruction.recipient!,
      //     parsedInstruction.amount!,
      //     parsedInstruction.token,
      //     effectiveNetwork as "localnet" | "devnet" | "mainnet",
      //   )

      //   if (result && result.success) {
      //     // Add explorer link to the success message
      //     addAIMessage(
      //       `✅ ${result.message}\n\n` +
      //         `Transaction ID: ${result.signature}\n\n` +
      //         `View in [Solana Explorer](${result.explorerUrl})`,
      //     )
      //   } else {
      //     addAIMessage(`❌ Transaction failed: ${result?.message || 'Unknown error'}\n\nError details: ${result?.error || 'No details available'}`)
      //      console.error("Transaction failure details:", result)
      //   }
      // } else if (parsedInstruction.isPayment) {
      //   addAIMessage(
      //     "I'm not completely sure about your payment details. Could you please provide the amount, token type, and recipient address more clearly?",
      //   )
      // } else {
      //   // Handle non-payment messages with a default response
      //   addAIMessage(
      //     "I'm here to help with your crypto payments. To send funds, just tell me something like 'send 10 USDC to address...'",
      //   )
      // }
      else {
        console.log("Instruction not specifically handled, showing help:", parsedInstruction);
        addAIMessage(
          "Sorry, I didn't understand that. I can help with:\n" +
          "• Balance checks (`balance`, `list all tokens`)\n" +
          "• Minting test tokens (`mint 10 USDC`)\n" +
          "• Swapping tokens (`swap 1 SOL for USDC`)\n" +
          "• Sending payments (`send 0.5 SOL to ADDRESS`)\n" +
          "• Burning tokens (`burn 5 NIX`, `burn 10 from mint ADDRESS`)\n" +
          "• Cleaning up tokens (`cleanup unknown tokens`, `cleanup all tokens`)\n" +
          "• Fixing token names (`fix token names`)"
        );
        setIsLoading(false);
        return; // Technically redundant here, but good practice
      }

    } catch (error) {
      console.error("Payment execution error:", error)
      addAIMessage(`❌ Transaction error: ${error instanceof Error ? error.message : String(error)}`)
    
    }

    setIsLoading(false)
  }, [wallet, connection, network, addAIMessage, messages]);

  const MessageWithLinks = (text: string) => {
    // Handle direct URLs
    const urlRegex = /(https?:\/\/[^\s)]+)/g;
  
    // Handle Markdown links [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    // Process Markdown links first
    const markdownParts = [];
    let lastIndex = 0;
    let match;

    while ((match = markdownLinkRegex.exec(text)) !== null) {
      const [fullMatch, linkText, url] = match;
      const matchIndex = match.index;

      // Add text before the match
      if (matchIndex > lastIndex) {
        markdownParts.push(text.substring(lastIndex, matchIndex));
      }

      // Add the link component
      markdownParts.push(
        <a
          key={`md-${url}-${matchIndex}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-300 dark:text-purple-300 light:text-purple-600 hover:underline"
        >
          {linkText}
        </a>
      );

      lastIndex = matchIndex + fullMatch.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      markdownParts.push(text.substring(lastIndex));
    }

    // Process any direct URLs in text segments
    const processedParts = markdownParts.map((part, index) => {
      if (typeof part === "string") {
        const urlParts = []
        let urlLastIndex = 0
        let urlMatch

        while ((urlMatch = urlRegex.exec(part)) !== null) {
          const [url] = urlMatch
          const urlMatchIndex = urlMatch.index

          // Add text before the URL
          if (urlMatchIndex > urlLastIndex) {
            urlParts.push(part.substring(urlLastIndex, urlMatchIndex))
          }

          // Add the URL as a link
          urlParts.push(
            <a
              key={`url-${url}-${urlMatchIndex}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-300 dark:text-purple-300 light:text-purple-600 hover:underline"
            >
              {url}
            </a>,
          )

          urlLastIndex = urlMatchIndex + url.length
        }

        // Add remaining text
        if (urlLastIndex < part.length) {
          urlParts.push(part.substring(urlLastIndex))
        }

        return urlParts.length > 1 ? urlParts : part
      }

      return part
    })

    return <pre className="whitespace-pre-wrap break-words font-sans">{processedParts}</pre>
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-950 to-gray-900 dark:from-gray-950 dark:to-gray-900 light:from-gray-100 light:to-white text-gray-100 dark:text-gray-100 light:text-gray-800">
      <div className="p-4 border-b border-gray-800 dark:border-gray-800 light:border-gray-200 flex justify-between items-center">
        <h2 className="text-xl font-bold">Web3 Assistant</h2>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={navigateToSwap}
            variant="ghost"
            size="sm"
            className="text-purple-400 hover:text-purple-300"
            title="Swap Tokens"
          >
            <ArrowDownUp className="h-4 w-4 mr-1" />
            <span className="text-sm">Swap</span>
          </Button>
          <Button 
            onClick={handleNewChat}
            variant="ghost" 
            size="sm"
            className="text-gray-400 hover:text-white"
            title="New Chat"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            <span className="text-sm">New Chat</span>
          </Button>
          <Button 
            onClick={clearTokenCache}
            variant="ghost" 
            size="sm"
            className="text-red-400 hover:text-red-300"
            title="Clear Token Cache"
          >
            <DatabaseZap className="h-4 w-4 mr-1" />
            <span className="text-sm">Clear Cache</span>
          </Button>
          <Button 
            onClick={handleCleanupAllTokens}
            variant="ghost" 
            size="sm"
            className="text-orange-400 hover:text-orange-300"
            title="Remove All Tokens"
          >
            <Ban className="h-4 w-4 mr-1" />
            <span className="text-sm">Clear Tokens</span>
          </Button>
          <NetworkSwitcher />
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
          <AnimatePresence initial={false}>
            {memoizedMessages.map((message) => (
              <MessageComponent 
                key={message.id} 
                message={message} 
                isClient={isClient} 
                formatTime={formatTime}
                MessageWithLinks={MessageWithLinks}
              />
            ))}
            {isLoading && (
              <div className="flex max-w-[80%] items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-800 dark:bg-gray-800 light:bg-gray-200">
                  <span className="text-sm font-semibold">AI</span>
                </div>
                <div className="rounded-lg px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-700 dark:from-gray-800 dark:to-gray-700 light:from-gray-200 light:to-gray-100 animate-pulse">
                  <div className="h-4 w-16 bg-gray-700 dark:bg-gray-700 light:bg-gray-300 rounded"></div>
                </div>
              </div>
            )}
          </AnimatePresence>
        </ScrollArea>
      </div>
      <div className="border-t border-gray-800 dark:border-gray-800 light:border-gray-200 p-4 bg-gray-900 dark:bg-gray-900 light:bg-gray-50 sticky bottom-0 z-10 shadow-lg">
        <ChatInputForm 
          onSendMessage={handleInputSend} 
          isLoading={isLoading} 
          walletConnected={wallet.connected} 
        />
      </div>
    </div>
  )
}