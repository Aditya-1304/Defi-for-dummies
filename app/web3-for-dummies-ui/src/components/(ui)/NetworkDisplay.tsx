"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function NetworkDisplay() {
  const searchParams = useSearchParams();
  const [network, setNetwork] = useState<string>('localnet');
  
  useEffect(() => {
    const networkParam = searchParams.get('network');
    if (networkParam === 'devnet' || networkParam === 'mainnet') {
      setNetwork(networkParam);
    } else {
      setNetwork('localnet');
    }
  }, [searchParams]);

  return (
    <div className="bg-gray-800 text-white px-3 py-1 rounded-full text-xs font-medium">
      {network.charAt(0).toUpperCase() + network.slice(1)}
    </div>
  );
}