// src/components/chat/chat-interface.tsx
"use client"

import { useState, useEffect, useRef, useMemo, memo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { motion, AnimatePresence } from "framer-motion"
import { Send } from "lucide-react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { parsePaymentInstruction } from "@/services/nlp-service"
import { executePayment, getWalletBalance, mintTestTokens, getAllWalletBalances } from "@/services/solana-service"
import * as React from "react"
import type { JSX } from 'react'
import { Trash2 } from "lucide-react"

import dynamic from 'next/dynamic'
import { burnSpecificTokenAmount, cleanupUnwantedTokens } from "@/services/tokens-service"

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
  const wallet = useWallet()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const networkOptions = ["localnet", "devnet", "mainnet"] as const
  const [network, setNetwork] = useState<"localnet" | "devnet" | "mainnet">(networkOptions[0])

  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isClient, setIsClient] = useState(false)

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
  }

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

      if (parsedInstruction.isBalanceCheck || parsedInstruction.isPayment) {
        const userInputLower = userInput.toLowerCase()

        // If user specifies a network that's different from the current one
        if (
          (userInputLower.includes("devnet") && network !== "devnet") ||
          (userInputLower.includes("mainnet") && network !== "mainnet") ||
          ((userInputLower.includes("localnet") || userInputLower.includes("local")) && network !== "localnet")
        ) {
          // Extract the network from user input
          let requestedNetwork = "localnet"
          if (userInputLower.includes("devnet")) requestedNetwork = "devnet"
          if (userInputLower.includes("mainnet")) requestedNetwork = "mainnet"

          // Tell the user we need to switch networks
          addAIMessage(`To perform this action on ${requestedNetwork}, I need to switch networks. Redirecting...`)

          // Short delay before redirect
          setTimeout(() => {
            window.location.href = `/chat?network=${requestedNetwork}`
          }, 1500)

          setIsLoading(false)
          return
        }
      }

      if (parsedInstruction.isBalanceCheck) {
        if (!wallet.connected) {
          addAIMessage("Please connect your wallet to check your balance.")
          setIsLoading(false)
          return
        }
        
        // Get network from URL or user input
        const params = new URLSearchParams(window.location.search)
        const urlNetwork = params.get("network")
        const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet"
        
        // Start with the URL network as default
        let network = effectiveNetwork
        
        const userInputLower = userInput.toLowerCase()
        if (userInputLower.includes("devnet")) {
          console.log("Using devnet based on user input")
          network = "devnet"
        } else if (userInputLower.includes("mainnet")) {
          console.log("Using mainnet based on user input") 
          network = "mainnet"
        } else if (userInputLower.includes("localnet") || userInputLower.includes("local")) {
          console.log("Using localnet based on user input")
          network = "localnet"
        } else {
          console.log(`Using current URL network: ${network}`)
        }
        
        // Check if this is a complete balance check or specific token check
        if (parsedInstruction.isCompleteBalanceCheck) {
          console.log(`Checking all token balances on ${network}`)
          addAIMessage(`Checking all your token balances on ${network}...`)
          
          const result = await getAllWalletBalances(
            connection, 
            wallet, 
            network as "localnet" | "devnet" | "mainnet",
            { initialOnly: false }
          )
          
          if (result.success) {
            addAIMessage(`💰 ${result.message}`)
          } else {
            addAIMessage(`❌ ${result?.message || 'Failed to get balances'}`)
          }
        } else {
          // This is a specific token balance check
          const token = parsedInstruction.token || "SOL"
          console.log(`Checking ${token} balance on network: ${network}`)
          addAIMessage(`Checking your ${token} balance on ${network}...`)
          
          const result = await getWalletBalance(
            connection, 
            wallet, 
            token, 
            network as "localnet" | "devnet" | "mainnet"
          )
          
          if (result.success) {
            addAIMessage(`💰 ${result.message}`)
          } else {
            addAIMessage(`❌ ${result?.message || 'Failed to get balance'}`)
          }
        }
        
        setIsLoading(false)
        return
      }

      // In your handleSend function in chat-interface.tsx, add handling for mint requests
      if (parsedInstruction.isMintRequest) {
        if (!wallet.connected) {
          addAIMessage("Please connect your wallet to mint tokens.");
          setIsLoading(false);
          return;
        }
        console.log("Mint request detected with parsed instruction:", parsedInstruction);
  
        const token = parsedInstruction.token || "USDC";
        const amount = parsedInstruction.amount !== null ? parsedInstruction.amount : 100;
        
        
        const params = new URLSearchParams(window.location.search);
        const urlNetwork = params.get("network");
        const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet";
        
        console.log(`About to mint ${amount} ${token} tokens on ${effectiveNetwork}`);
        addAIMessage(`Minting ${amount} ${token} tokens on ${effectiveNetwork}...`);
        
        const result = await mintTestTokens(
          connection,
          wallet,
          token,
          amount,
          effectiveNetwork as "localnet" | "devnet" | "mainnet"
        );
        
        if (result.success) {
          addAIMessage(`✅ ${result.message}`);
        } else {
          addAIMessage(`❌ ${result.message}`);
        }
        
        setIsLoading(false);
        return;
      }

      if (parsedInstruction.isTokenCleanup) {
        if (!wallet.connected) {
          addAIMessage("Please connect your wallet to clean up tokens.");
          setIsLoading(false);
          return;
        }
      
        const params = new URLSearchParams(window.location.search);
        const urlNetwork = params.get("network");
        const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet";
        
        const target = parsedInstruction.cleanupTarget || "unknown";
        const shouldBurn = parsedInstruction.burnTokens || false;
        
        // Update the message based on action
        if (shouldBurn) {
          if (target === "unknown") {
            addAIMessage(`Burning and cleaning up unknown tokens on ${effectiveNetwork}...`);
          } else if (Array.isArray(target)) {
            addAIMessage(`Burning and cleaning up ${target.join(', ')} tokens on ${effectiveNetwork}...`);
          }
        } else {
          if (target === "unknown") {
            addAIMessage(`Cleaning up unknown tokens on ${effectiveNetwork}...`);
          } else if (Array.isArray(target)) {
            addAIMessage(`Cleaning up ${target.join(', ')} tokens on ${effectiveNetwork}...`);
          }
        }
        
        try {
          const result = await cleanupUnwantedTokens(
            connection,
            wallet,
            target,
            effectiveNetwork as "localnet" | "devnet" | "mainnet",
            shouldBurn // Pass the burn flag
          );
          
          if (result.success) {
            if (result.removedTokens === 0) {
              addAIMessage(`No eligible token accounts found to clean up.`);
            } else {
              addAIMessage(`✅ ${result.message}`);
            }
          } else {
            addAIMessage(`❌ ${result.message}`);
          }
        } catch (error: any) {
          console.error("Token cleanup error:", error);
          addAIMessage(`❌ Failed to clean up tokens: ${error.message}`);
        }
        
        setIsLoading(false);
        return;
      }

      if (parsedInstruction.burnSpecificAmount) {
        if (!wallet.connected) {
          addAIMessage("Please connect your wallet to burn tokens.");
          setIsLoading(false);
          return;
        }
      
        const params = new URLSearchParams(window.location.search);
        const urlNetwork = params.get("network");
        const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet";
        
        const token = parsedInstruction.token || "USDC";
        const amount = parsedInstruction.burnAmount || 0;
        
        addAIMessage(`Burning ${amount} ${token} tokens on ${effectiveNetwork}...`);
        
        try {
          const result = await burnSpecificTokenAmount(
            connection,
            wallet,
            token,
            amount,
            effectiveNetwork as "localnet" | "devnet" | "mainnet",
            true
          );
          
          if (result.success) {
            if (result.signature) {
              // Create a Solana explorer link for the transaction
              const explorerUrl = effectiveNetwork === "mainnet" 
                ? `https://explorer.solana.com/tx/${result.signature}` 
                : `https://explorer.solana.com/tx/${result.signature}?cluster=${effectiveNetwork}`;
                
              addAIMessage(`✅ ${result.message} [View on Explorer](${explorerUrl})`);
            } else {
              addAIMessage(`✅ ${result.message}`);
            }
          } else {
            if (result.signature) {
              const explorerUrl = effectiveNetwork === "mainnet" 
                ? `https://explorer.solana.com/tx/${result.signature}` 
                : `https://explorer.solana.com/tx/${result.signature}?cluster=${effectiveNetwork}`;
                
              addAIMessage(`❌ ${result.message} [Check status](${explorerUrl})`);
            } else {
              addAIMessage(`❌ ${result.message}`);
            }
          }
        } catch (error: any) {
          console.error("Specific burn error:", error);
          
          // Try to extract signature from error if possible
          const signatureMatch = error.message?.match(/signature\s([A-Za-z0-9]+)/);
          const signature = signatureMatch ? signatureMatch[1] : null;
          
          if (signature) {
            const explorerUrl = effectiveNetwork === "mainnet" 
              ? `https://explorer.solana.com/tx/${signature}` 
              : `https://explorer.solana.com/tx/${signature}?cluster=${effectiveNetwork}`;
              
            addAIMessage(`⚠️ Transaction sent but confirmation timed out. [Check status on explorer](${explorerUrl})`);
          } else {
            addAIMessage(`❌ Failed to burn tokens: ${error.message}`);
          }
        }
        
        setIsLoading(false);
        return;
      }
      

      // Lower the confidence threshold for Gemini
      if (parsedInstruction.isPayment && parsedInstruction.confidence > 0.5) {
        // Check for missing required fields
        if (!parsedInstruction.recipient || !parsedInstruction.amount || !parsedInstruction.token) {
          addAIMessage(
            "I need a complete payment instruction with amount, token, and recipient address. For example: 'send 0.1 SOL to address'",
          )
          setIsLoading(false)
          return
        }

        // Check wallet connection
        if (!wallet.connected) {
          addAIMessage("Please connect your wallet to make this payment.")
          setIsLoading(false)
          return
        }

        const params = new URLSearchParams(window.location.search)
        const urlNetwork = params.get("network")
        const effectiveNetwork = urlNetwork === "devnet" || urlNetwork === "mainnet" ? urlNetwork : "localnet"

        console.log(`Using network from URL: ${effectiveNetwork}`)

        // Request payment confirmation with correct network
        addAIMessage(
          `I'll help you send ${parsedInstruction.amount} ${parsedInstruction.token} to ${parsedInstruction.recipient} on ${effectiveNetwork}. Please confirm this transaction.`,
        )

        // Execute payment using the network from URL
        const result = await executePayment(
          connection,
          wallet,
          parsedInstruction.recipient!,
          parsedInstruction.amount!,
          parsedInstruction.token,
          effectiveNetwork as "localnet" | "devnet" | "mainnet",
        )

        if (result && result.success) {
          // Add explorer link to the success message
          addAIMessage(
            `✅ ${result.message}\n\n` +
              `Transaction ID: ${result.signature}\n\n` +
              `View in [Solana Explorer](${result.explorerUrl})`,
          )
        } else {
          addAIMessage(`❌ Transaction failed: ${result?.message || 'Unknown error'}\n\nError details: ${result?.error || 'No details available'}`)
           console.error("Transaction failure details:", result)
        }
      } else if (parsedInstruction.isPayment) {
        addAIMessage(
          "I'm not completely sure about your payment details. Could you please provide the amount, token type, and recipient address more clearly?",
        )
      } else {
        // Handle non-payment messages with a default response
        addAIMessage(
          "I'm here to help with your crypto payments. To send funds, just tell me something like 'send 10 USDC to address...'",
        )
      }
    } catch (error) {
      console.error("Payment execution error:", error)
      addAIMessage(`❌ Transaction error: ${error instanceof Error ? error.message : String(error)}`)
    
    }

    setIsLoading(false)
  }, [wallet, connection, network, addAIMessage]);

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
            onClick={handleNewChat}
            variant="ghost" 
            size="sm"
            className="text-gray-400 hover:text-white"
            title="New Chat"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            <span className="text-sm">New Chat</span>
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