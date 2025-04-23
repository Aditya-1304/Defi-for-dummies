// "use client";

// import { useEffect } from "react";
// import { useSearchParams } from 'next/navigation';
// import { ChatInterface } from "@/components/chat/chat-interface";
// import { WalletContextProvider } from "@/components/wallet/wallet-provider";

// const ChatPage = () => {
//   const searchParams = useSearchParams();
  
//   // Log the network parameter for debugging
//   useEffect(() => {
//     const networkParam = searchParams?.get('network');
//     console.log("Page received network parameter:", networkParam);
//   }, [searchParams]);
  
//   return (
//     <WalletContextProvider>
//       <div className="w-full">
//         {/* <Navbar title="Chat" /> */}
//         <ChatInterface />
//       </div>
//     </WalletContextProvider>
//   );
// };

// export default ChatPage;

"use client";

// Import Suspense
import { useEffect, Suspense } from "react"; 
import { useSearchParams } from 'next/navigation';
// Removed Navbar import as it was commented out
// import { Navbar } from "@/components/(ui)/navbar"; 
import { ChatInterface } from "@/components/chat/chat-interface";
import { WalletContextProvider } from "@/components/wallet/wallet-provider";

// Create a new component that uses useSearchParams
function ChatPageContent() {
  const searchParams = useSearchParams();
  
  // Log the network parameter for debugging
  useEffect(() => {
    const networkParam = searchParams?.get('network');
    console.log("Page received network parameter:", networkParam);
    // You might want to pass networkParam down to ChatInterface if needed
    // Or let ChatInterface read it directly as it already does
  }, [searchParams]);

  return (
    <div className="w-full">
      {/* <Navbar title="Chat" /> */}
      {/* ChatInterface will read the params itself via its own useEffect */}
      <ChatInterface /> 
    </div>
  );
}

// Main page component wraps the content in Suspense
const ChatPage = () => {
  return (
    <WalletContextProvider>
      {/* Wrap the component using useSearchParams in Suspense */}
      <Suspense fallback={<div>Loading chat...</div>}> 
        <ChatPageContent />
      </Suspense>
    </WalletContextProvider>
  );
};

export default ChatPage;