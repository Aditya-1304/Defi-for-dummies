// // "use client";

// // import { motion, useScroll, useTransform } from "framer-motion";
// // import { Button } from "@/components/ui/button";
// // import { Sparkles } from "lucide-react";

// // export function FloatingNav() {
// //   const { scrollYProgress } = useScroll();
// //   const opacity = useTransform(scrollYProgress, [0, 0.1], [0, 1]);
// //   const y = useTransform(scrollYProgress, [0, 0.1], [-100, 0]);

// //   return (
// //     <motion.div style={{ opacity, y }} className="fixed top-4 left-1/2 z-50 -translate-x-1/2">
// //       <div className="flex items-center gap-4 rounded-full border bg-background/95 px-4 py-2 shadow-lg backdrop-blur">
// //         <Sparkles className="h-5 w-5 text-primary" />
// //         <nav className="flex items-center gap-4">
// //           <a href="#features" className="text-sm font-medium hover:text-primary">
// //             Features
// //           </a>
// //           <a href="#testimonials" className="text-sm font-medium hover:text-primary">
// //             Testimonials
// //           </a>
// //           <Button size="sm">Get Started</Button>
// //         </nav>
// //       </div>
// //     </motion.div>
// //   );
// // }

// // "use client";

// // import { motion, useScroll, useTransform } from "framer-motion";
// // import { Button } from "@/components/ui/button";
// // import { Sparkles } from "lucide-react";
// // import Link from "next/link"; // Import Link from Next.js

// // export function FloatingNav() {
// //   const { scrollYProgress } = useScroll();
// //   // Make it appear slightly earlier and fade in smoothly
// //   const opacity = useTransform(scrollYProgress, [0, 0.05, 0.1], [0, 0, 1]);
// //   const y = useTransform(scrollYProgress, [0, 0.1], [-100, 0]);

// //   return (
// //     <motion.div
// //       style={{ opacity, y }}
// //       className="fixed top-4 left-1/2 z-50 -translate-x-1/2"
// //       transition={{ duration: 0.3, ease: "easeInOut" }} // Add smooth transition for appearance
// //     >
// //       {/* Slightly increased padding, softer shadow, more blur */}
// //       <div className="flex items-center gap-4 rounded-full border border-border/30 bg-background/80 px-5 py-2 shadow-md backdrop-blur-lg">
// //         <Sparkles className="h-5 w-5 text-primary" />
// //         <nav className="flex items-center gap-5"> {/* Increased gap slightly */}
// //           <a
// //             href="#features"
// //             className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary" // Added transition
// //           >
// //             Features
// //           </a>
// //           <a
// //             href="#testimonials"
// //             className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary" // Added transition
// //           >
// //             Testimonials
// //           </a>
// //           {/* Use Next.js Link for client-side navigation */}
// //           <Link href="/chat" passHref legacyBehavior>
// //             <Button asChild size="sm">
// //               <a>Get Started</a>
// //             </Button>
// //           </Link>
// //         </nav>
// //       </div>
// //     </motion.div>
// //   );
// // }

// "use client";

// import { motion, useScroll, useTransform } from "framer-motion";
// import { Button } from "@/components/ui/button";
// import { Sparkles } from "lucide-react";
// import Link from "next/link";
// import { useState, useEffect } from "react";

// export function FloatingNav() {
//   const { scrollYProgress } = useScroll();
//   const opacity = useTransform(scrollYProgress, [0, 0.05, 0.1], [0, 0, 1]);
//   const y = useTransform(scrollYProgress, [0, 0.1], [-100, 0]);
  
//   // Add state to track scroll position for enhanced blur effect
//   const [scrollPosition, setScrollPosition] = useState(0);
  
//   useEffect(() => {
//     const handleScroll = () => {
//       setScrollPosition(window.scrollY);
//     };
    
//     window.addEventListener('scroll', handleScroll);
//     return () => window.removeEventListener('scroll', handleScroll);
//   }, []);
  
//   // Calculate blur amount based on scroll position
//   const blurAmount = scrollPosition > 100 ? "backdrop-blur-xl" : "backdrop-blur-lg";
//   const bgOpacity = scrollPosition > 100 ? "bg-gray-900/85" : "bg-gray-900/75";

//   return (
//     <motion.div
//       style={{ opacity, y }}
//       className="fixed top-4 left-1/2 z-50 -translate-x-1/2"
//       transition={{ duration: 0.3, ease: "easeInOut" }}
//     >
//       {/* Enhanced blur and background effects */}
//       <div className={`flex items-center gap-4 rounded-full border border-blue-500/30 ${bgOpacity} px-5 py-2 shadow-md ${blurAmount} transition-all duration-300`}>
//         <Sparkles className="h-5 w-5 text-blue-500" />
//         <nav className="flex items-center gap-5">
//           <a
//             href="#features"
//             className="text-sm font-medium text-gray-300 transition-colors hover:text-blue-400"
//           >
//             Features
//           </a>
//           <a
//             href="#testimonials"
//             className="text-sm font-medium text-gray-300 transition-colors hover:text-blue-400"
//           >
//             Testimonials
//           </a>
//           <Link href="/chat" passHref legacyBehavior>
//             <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
//               <a>Get Started</a>
//             </Button>
//           </Link>
//         </nav>
//       </div>
//     </motion.div>
//   );
// }
"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import Link from "next/link";
// Remove useState and useEffect for now if not strictly needed for the blur effect itself
// import { useState, useEffect } from "react";

export function FloatingNav() {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.05, 0.1], [0, 0, 1]);
  const y = useTransform(scrollYProgress, [0, 0.1], [-100, 0]);

  // Use a fixed, more transparent background and consistent blur for testing
  const fixedBgOpacity = "bg-background/60"; // Or try bg-black/50, bg-white/50 depending on your theme
  const fixedBlurAmount = "backdrop-blur-lg"; // Or backdrop-blur-md

  return (
    <motion.div
      style={{ opacity, y }}
      // Ensure high z-index
      className="fixed top-4 left-1/2 z-[100] -translate-x-1/2" // Increased z-index just in case
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* Apply fixed transparency and blur */}
      <div
        className={`flex items-center gap-4 rounded-full border border-blue-500/30 ${fixedBgOpacity} px-5 py-2 shadow-lg ${fixedBlurAmount}`}
      >
        <Sparkles className="h-5 w-5 text-blue-500" />
        <nav className="flex items-center gap-5">
          <a
            href="#features"
            className="text-sm font-medium text-gray-300 transition-colors hover:text-blue-400"
          >
            Features
          </a>
          <a
            href="#testimonials"
            className="text-sm font-medium text-gray-300 transition-colors hover:text-blue-400"
          >
            Testimonials
          </a>
          <Link href="/chat" passHref legacyBehavior>
            <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              <a>Get Started</a>
            </Button>
          </Link>
        </nav>
      </div>
    </motion.div>
  );
}