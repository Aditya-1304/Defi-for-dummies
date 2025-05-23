"use client";

// import { ModeToggle } from "@/components/(ui)/mode-toggle";
// import { Button } from "@/components/ui/button";
// import { Bell } from "lucide-react";
// import { usePathname } from "next/navigation";


// export function Navbar({ title }: { title: string }) {
  
//   const pathName = usePathname();

//   return (
//     <header className="border-b">
//       <div className="flex h-16 items-center px-4 gap-4">
//         <div className="flex-1">
//           <h1 className="text-2xl font-semibold">{title}</h1>
//         </div>
//         <Button variant="ghost" size="icon">
//           <Bell className="h-5 w-5" />
//         </Button>
//         <ModeToggle />
        
//       </div>
//     </header>
//   );
// }

"use client";

import { ModeToggle } from "@/components/(ui)/mode-toggle";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { WalletButton } from "../wallet/wallet-button";

export function Navbar({ title }: { title: string }) {
  const pathName = usePathname();
  return (
    <header className="border-b">
      <div className="flex h-16 items-center px-4 gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
        </div>
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
        <ModeToggle />
        <WalletButton />
      </div>
    </header>
  );
}