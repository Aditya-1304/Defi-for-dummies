"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

export function NetworkSwitcher() {
  const searchParams = useSearchParams();
  const currentNetwork = searchParams.get('network') || 'localnet';

  const handleNetworkChange = (network: string) => {
    console.log("Network change requested:", network);
    
    // Force a COMPLETE page reload (not just a client-side navigation)
    // This is critical for the wallet adapter to reconnect properly
    const baseUrl = window.location.origin + "/chat";
    const fullUrl = `${baseUrl}?network=${network}`;
    
    console.log("Reloading page with new URL:", fullUrl);
    
    // This is the key difference - using location.href triggers a full page reload
    window.location.href = fullUrl;
  };

  return (
    <div className="flex items-center gap-2">
      {/* <span className={`h-2 w-2 rounded-full ${
        currentNetwork === 'devnet' ? 'bg-yellow-500' : 
        currentNetwork === 'mainnet' ? 'bg-green-500' : 
        'bg-blue-500'
      }`}></span> */}
      
      <Select value={currentNetwork} onValueChange={handleNetworkChange}>
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