"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParams } from "next/navigation";

export function NetworkSwitcher() {
  const searchParams = useSearchParams();
  const currentNetwork = searchParams.get('network') || 'localnet';

  const handleNetworkChange = (network: string) => {
    console.log("Network change requested:", network);
    
    // Preserve other query parameters if any
    const newParams = new URLSearchParams(window.location.search);
    newParams.set('network', network);
    
    // Force a COMPLETE page reload with new URL
    const baseUrl = window.location.origin + "/chat";
    const fullUrl = `${baseUrl}?${newParams.toString()}`;
    
    console.log("Reloading page with new URL:", fullUrl);
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