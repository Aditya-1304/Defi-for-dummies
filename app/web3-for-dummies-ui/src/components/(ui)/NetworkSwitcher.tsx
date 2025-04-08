"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNetwork } from "@/components/(ui)/network-context";

export function NetworkSwitcher() {
  const { network, setNetwork } = useNetwork();

  const handleNetworkChange = (newNetwork: string) => {
    console.log("Network change requested:", newNetwork);
    
    // Update the network context instead of reloading the page
    setNetwork(newNetwork as "localnet" | "devnet" | "mainnet");
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={network} onValueChange={handleNetworkChange}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Network" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="localnet">Localnet</SelectItem>
          <SelectItem value="devnet">Devnet</SelectItem>
          <SelectItem value="mainnet">Mainnet</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}