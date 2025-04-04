"use client";

import { Navbar } from "@/components/(ui)/navbar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { WalletContextProvider } from "@/components/wallet/wallet-provider";

const ChatPage = () => {
  return (
    <WalletContextProvider>
      <div className="w-full">
        <Navbar title="Chat" />
        <ChatInterface />
      </div>
    </WalletContextProvider>
  );
};

export default ChatPage;