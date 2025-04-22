// "use client";

// import { motion, useScroll, useTransform } from "framer-motion";
// import { Button } from "@/components/ui/button";
// import { Sparkles } from "lucide-react";

// export function FloatingNav() {
//   const { scrollYProgress } = useScroll();
//   const opacity = useTransform(scrollYProgress, [0, 0.1], [0, 1]);
//   const y = useTransform(scrollYProgress, [0, 0.1], [-100, 0]);

//   return (
//     <motion.div style={{ opacity, y }} className="fixed top-4 left-1/2 z-50 -translate-x-1/2">
//       <div className="flex items-center gap-4 rounded-full border bg-background/95 px-4 py-2 shadow-lg backdrop-blur">
//         <Sparkles className="h-5 w-5 text-primary" />
//         <nav className="flex items-center gap-4">
//           <a href="#features" className="text-sm font-medium hover:text-primary">
//             Features
//           </a>
//           <a href="#testimonials" className="text-sm font-medium hover:text-primary">
//             Testimonials
//           </a>
//           <Button size="sm">Get Started</Button>
//         </nav>
//       </div>
//     </motion.div>
//   );
// }

"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import Link from "next/link"; // Import Link from Next.js

export function FloatingNav() {
  const { scrollYProgress } = useScroll();
  // Make it appear slightly earlier and fade in smoothly
  const opacity = useTransform(scrollYProgress, [0, 0.05, 0.1], [0, 0, 1]);
  const y = useTransform(scrollYProgress, [0, 0.1], [-100, 0]);

  return (
    <motion.div
      style={{ opacity, y }}
      className="fixed top-4 left-1/2 z-50 -translate-x-1/2"
      transition={{ duration: 0.3, ease: "easeInOut" }} // Add smooth transition for appearance
    >
      {/* Slightly increased padding, softer shadow, more blur */}
      <div className="flex items-center gap-4 rounded-full border border-border/30 bg-background/80 px-5 py-2 shadow-md backdrop-blur-lg">
        <Sparkles className="h-5 w-5 text-primary" />
        <nav className="flex items-center gap-5"> {/* Increased gap slightly */}
          <a
            href="#features"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary" // Added transition
          >
            Features
          </a>
          <a
            href="#testimonials"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary" // Added transition
          >
            Testimonials
          </a>
          {/* Use Next.js Link for client-side navigation */}
          <Link href="/chat" passHref legacyBehavior>
            <Button asChild size="sm">
              <a>Get Started</a>
            </Button>
          </Link>
        </nav>
      </div>
    </motion.div>
  );
}