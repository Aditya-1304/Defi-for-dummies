// src/components/chat/chat-interface.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { parsePaymentInstruction } from "@/services/nlp-service";
import { executePayment } from "@/services/solana-service";
import { WalletButton } from "@/components/wallet/wallet-button";

interface Message {
  id: string; // Change from number to string
  content: string;
  sender: "user" | "ai";
  timestamp: string; // Change from Date to string
}

export function ChatInterface() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-message",
      content: "Hello! I'm your DeFi companion. How can I help you today?",
      sender: "ai",
      timestamp: new Date().toISOString(), // Store as string
    },
  ]);
  const [input, setInput] = useState("");
  const [isClient, setIsClient] = useState(false);

  // Set isClient to true when component mounts on client side
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`, // Create unique ID with timestamp
      content: input,
      sender: "user",
      timestamp: new Date().toISOString(), // Store as string
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    
    const userInput = input;
    setInput("");

    try {
      // Process with NLP
      const parsedInstruction = await parsePaymentInstruction(userInput);
    
    console.log("Parsed instruction:", parsedInstruction);
    
    // Lower the confidence threshold for Gemini
    if (parsedInstruction.isPayment && parsedInstruction.confidence > 0.5) {
      // Check for missing required fields
      if (!parsedInstruction.recipient || !parsedInstruction.amount || !parsedInstruction.token) {
        addAIMessage("I need a complete payment instruction with amount, token, and recipient address. For example: 'send 0.1 SOL to address'");
        setIsLoading(false);
        return;
      }

      // Check wallet connection
      if (!wallet.connected) {
        addAIMessage("Please connect your wallet to make this payment.");
        setIsLoading(false);
        return;
      }
      
      // Request payment confirmation
      addAIMessage(`I'll help you send ${parsedInstruction.amount} ${parsedInstruction.token} to ${parsedInstruction.recipient}. Please confirm this transaction.`);
        
        // Execute payment
        const result = await executePayment(
          connection,
          wallet,
          parsedInstruction.recipient!,
          parsedInstruction.amount!,
          parsedInstruction.token
        );
        
        if (result.success) {
          // Add explorer link to the success message
          addAIMessage(
            `✅ ${result.message}\n\n` +
            `Transaction ID: ${result.signature}\n\n` +
            `View in [Solana Explorer](${result.explorerUrl})`
          );
        } else {
          addAIMessage(`❌ ${result.message}`);
        }
      } else if (parsedInstruction.isPayment) {
        addAIMessage("I'm not completely sure about your payment details. Could you please provide the amount, token type, and recipient address more clearly?");
      } else {
        // Handle non-payment messages with a default response
        addAIMessage("I'm here to help with your crypto payments. To send funds, just tell me something like 'send 10 USDC to address...'");
      }
    } catch (error) {
      console.error("Error processing message:", error);
      addAIMessage("Sorry, I encountered an error processing your request. Please try again.");
    }
    
    setIsLoading(false);
  };
  
  const addAIMessage = (content: string) => {
    const aiMessage: Message = {
      id: `ai-${Date.now()}`, // Create unique ID with timestamp
      content,
      sender: "ai",
      timestamp: new Date().toISOString(), // Store as string
    };
    setMessages((prev) => [...prev, aiMessage]);
  };
  

  const MessageWithLinks = (text: string) => {
    // Handle direct URLs
    const urlRegex = /(https?:\/\/[^\s)]+)/g;
    // Handle Markdown links [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    let result = text;
    
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
          className="text-blue-500 hover:underline"
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
      if (typeof part === 'string') {
        const urlParts = [];
        let urlLastIndex = 0;
        let urlMatch;
        
        while ((urlMatch = urlRegex.exec(part)) !== null) {
          const [url] = urlMatch;
          const urlMatchIndex = urlMatch.index;
          
          // Add text before the URL
          if (urlMatchIndex > urlLastIndex) {
            urlParts.push(part.substring(urlLastIndex, urlMatchIndex));
          }
          
          // Add the URL as a link
          urlParts.push(
            <a 
              key={`url-${url}-${urlMatchIndex}`} 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-500 hover:underline"
            >
              {url}
            </a>
          );
          
          urlLastIndex = urlMatchIndex + url.length;
        }
        
        // Add remaining text
        if (urlLastIndex < part.length) {
          urlParts.push(part.substring(urlLastIndex));
        }
        
        return urlParts.length > 1 ? urlParts : part;
      }
      
      return part;
    });
    
    return (
      <pre className="whitespace-pre-wrap break-words font-sans">
        {processedParts}
      </pre>
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit', 
      hour12: false 
    });
  };

  return (
    <Card className="flex flex-col min-h-[96vh]">
      <div className="p-4 border-b flex justify-between items-center">
      <h2 className="text-xl font-bold">Web3 Assistant</h2>
      {isClient && <WalletButton />}
    </div>
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`mb-4 flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex max-w-[80%] items-start gap-3 ${message.sender === "user" ? "flex-row-reverse" : ""}`}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={message.sender === "ai" ? "/bot-avatar.png" : "/user-avatar.png"} />
                  <AvatarFallback>{message.sender === "ai" ? "AI" : "U"}</AvatarFallback>
                </Avatar>
                <div className={`rounded-lg px-4 py-2 ${message.sender === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {MessageWithLinks(message.content)}
                  {isClient && <p className="mt-1 text-xs opacity-70">{formatTime(message.timestamp)}</p>}
                </div>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className={`flex max-w-[80%] items-start gap-3`}>
              <Avatar className="h-8 w-8">
                <AvatarImage src="/bot-avatar.png" />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <div className="rounded-lg px-4 py-2 bg-muted animate-pulse">
                <div className="h-4 w-16 bg-muted-foreground/20 rounded"></div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </ScrollArea>
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input 
            placeholder={wallet.connected ? "Type 'send 10 USDC to address...'" : "Connect wallet to send payments..."}
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            className="flex-1" 
          />
          <Button type="submit" size="icon" disabled={isLoading}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>
    </Card>
  );
}