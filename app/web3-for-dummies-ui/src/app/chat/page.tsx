"use client";

import { useEffect } from "react";
import { useSearchParams } from 'next/navigation';
import { Navbar } from "@/components/(ui)/navbar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { WalletContextProvider } from "@/components/wallet/wallet-provider";

const ChatPage = () => {
  const searchParams = useSearchParams();
  
  // Log the network parameter for debugging
  useEffect(() => {
    const networkParam = searchParams?.get('network');
    console.log("Page received network parameter:", networkParam);
  }, [searchParams]);
  
  return (
    <WalletContextProvider>
      <div className="w-full">
        {/* <Navbar title="Chat" /> */}
        <ChatInterface />
      </div>
    </WalletContextProvider>
  );
};

export default ChatPage;