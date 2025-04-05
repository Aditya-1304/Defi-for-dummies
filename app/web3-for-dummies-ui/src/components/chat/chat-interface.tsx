// src/components/chat/chat-interface.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { motion, AnimatePresence } from "framer-motion"
import { Send } from "lucide-react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { parsePaymentInstruction } from "@/services/nlp-service"
import { executePayment, getWalletBalance } from "@/services/solana-service"
import { WalletButton } from "@/components/wallet/wallet-button"
import { NetworkSwitcher } from "../(ui)/NetworkSwitcher"
import { NetworkDisplay } from "../(ui)/NetworkDisplay"
import { Trash2 } from "lucide-react"
interface Message {
  id: string // Change from number to string
  content: string
  sender: "user" | "ai"
  timestamp: string // Change from Date to string
}

export function ChatInterface() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const networkOptions = ["localnet", "devnet", "mainnet"] as const
  const [network, setNetwork] = useState<"localnet" | "devnet" | "mainnet">(networkOptions[0])

  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isClient, setIsClient] = useState(false)

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

  // useEffect(() => {
  //   // Only update URL if it doesn't already match the current network
  //   const params = new URLSearchParams(window.location.search);
  //   const currentNetworkParam = params.get('network');

  //   // Only redirect if the URL param doesn't match the selected network
  //   if (currentNetworkParam !== network) {
  //     // Use history.replaceState instead of redirecting to avoid page reload
  //     const newUrl = window.location.origin + "/chat?network=" + network;
  //     window.history.replaceState({}, '', newUrl);
  //   }
  // }, [network]);

  // // Add another useEffect to read from URL params on component mount
  // useEffect(() => {
  //   const params = new URLSearchParams(window.location.search);
  //   const networkParam = params.get('network');
  //   if (networkParam === 'devnet' || networkParam === 'localnet' || networkParam === 'mainnet') {
  //     setNetwork(networkParam as "localnet" | "devnet" | "mainnet");
  //   }
  // }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const networkParam = params.get("network")
    // if (networkParam === "devnet" || networkParam === "localnet" || networkParam === "mainnet") {
    //   setNetwork(networkParam as "localnet" | "devnet" | "mainnet")
    // }
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
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem(`chat_messages_${network}`, JSON.stringify(messages))
    }
  }, [messages, network])

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

  const handleSend = async () => {
    if (!input.trim()) return

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // Create unique ID with timestamp
      content: input,
      sender: "user",
      timestamp: new Date().toISOString(), // Store as string
    }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    const userInput = input
    setInput("")

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
        const token = parsedInstruction.token || "SOL"
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

        console.log(`Checking balance on network: ${network}`)
        addAIMessage(`Checking your ${token} balance on ${network}...`)

        const result = await getWalletBalance(connection, wallet, token, network as "localnet" | "devnet" | "mainnet")

        if (result.success) {
          addAIMessage(`💰 ${result.message}`)
        } else {
          addAIMessage(`❌ ${result.message}`)
        }
        setIsLoading(false)
        return
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

        // let network = parsedInstruction.network || "localnet";
        // const userInputLower = userInput.toLowerCase();

        // if (userInputLower.includes("devnet") && network !== "devnet") {
        //   console.log("Force setting network to devnet based on user input");
        //   network = "devnet";
        // } else if (userInputLower.includes("mainnet") && network !== "mainnet") {
        //   console.log("Force setting network to mainnet based on user input");
        //   network = "mainnet";
        // } else if (userInputLower.includes("localnet") || userInputLower.includes("local")) {
        //   console.log("Force setting network to localnet based on user input");
        //   network = "localnet";
        // }

        // // Request payment confirmation
        // addAIMessage(`I'll help you send ${parsedInstruction.amount} ${parsedInstruction.token} to ${parsedInstruction.recipient}. Please confirm this transaction.`);

        //   // Execute payment
        //   const result = await executePayment(
        //     connection,
        //     wallet,
        //     parsedInstruction.recipient!,
        //     parsedInstruction.amount!,
        //     parsedInstruction.token,
        //     network
        //   );
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

        if (result.success) {
          // Add explorer link to the success message
          addAIMessage(
            `✅ ${result.message}\n\n` +
              `Transaction ID: ${result.signature}\n\n` +
              `View in [Solana Explorer](${result.explorerUrl})`,
          )
        } else {
          addAIMessage(`❌ ${result.message}`)
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
      console.error("Error processing message:", error)
      addAIMessage("Sorry, I encountered an error processing your request. Please try again.")
    }

    setIsLoading(false)
  }

  const addAIMessage = (content: string) => {
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
  };

  const MessageWithLinks = (text: string) => {
    // Handle direct URLs
    const urlRegex = /(https?:\/\/[^\s)]+)/g;
  
  // Handle Markdown links [text](url)
  // The issue is in this regex - the capture groups need fixing
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
        
        {/* <div className="flex items-center gap-3">
          {isClient && <WalletButton />} */}
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
            {/* <NetworkDisplay /> */}
            <NetworkSwitcher />
          </div>
        {/* </div> */}
      </div>
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
          <AnimatePresence initial={false}>
            {messages.map((message) => (
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
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex gap-2"
        >
          <Input
            placeholder={wallet.connected ? "Type 'send 10 USDC to address...'" : "Connect wallet to send payments..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
      </div>
    </div>
  )
}

