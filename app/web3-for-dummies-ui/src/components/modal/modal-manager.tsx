"use client";
import React, { useState } from 'react';
import { TokenRegistrationModal } from '../(ui)/token-registration';

// Create a context for modal management
export type ModalContextType = {
  openTokenRegistration: (options: {
    network: "localnet" | "devnet" | "mainnet",
    onSuccess?: () => void
  }) => void;
  closeTokenRegistration: () => void;
};

export const ModalContext = React.createContext<ModalContextType>({
  openTokenRegistration: () => {},
  closeTokenRegistration: () => {},
});

export const useModals = () => React.useContext(ModalContext);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [tokenRegistrationOpen, setTokenRegistrationOpen] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState<"localnet" | "devnet" | "mainnet">("localnet");
  const [onSuccessCallback, setOnSuccessCallback] = useState<(() => void) | undefined>(undefined);
  
  const openTokenRegistration = (options: {
    network: "localnet" | "devnet" | "mainnet",
    onSuccess?: () => void
  }) => {
    console.log("Opening token registration modal", options);
    setCurrentNetwork(options.network);
    setOnSuccessCallback(() => options.onSuccess);
    setTokenRegistrationOpen(true);
  };
  
  const closeTokenRegistration = () => {
    setTokenRegistrationOpen(false);
    setOnSuccessCallback(undefined);
  };
  
  const handleSuccess = () => {
    if (onSuccessCallback) onSuccessCallback();
    closeTokenRegistration();
  };
  
  return (
    <ModalContext.Provider value={{ 
      openTokenRegistration,
      closeTokenRegistration
    }}>
      {children}
      
      {/* The TokenRegistrationModal is rendered here, outside your component */}
      <TokenRegistrationModal 
        isOpen={tokenRegistrationOpen}
        onClose={closeTokenRegistration}
        network={currentNetwork}
        onSuccess={handleSuccess}
      />
    </ModalContext.Provider>
  );
}