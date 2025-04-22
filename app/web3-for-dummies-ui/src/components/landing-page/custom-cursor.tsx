// "use client";

// import { motion } from "framer-motion";

// export function CustomCursor({ mousePosition }: { mousePosition: { x: number; y: number } }) {
//   return (
//     <>
//       <motion.div
//         className="fixed z-50 pointer-events-none h-4 w-4 rounded-full bg-primary/30 mix-blend-difference"
//         animate={{
//           x: mousePosition.x - 8,
//           y: mousePosition.y - 8,
//         }}
//         transition={{
//           type: "spring",
//           damping: 50,
//           stiffness: 500,
//           mass: 0.1,
//         }}
//       />
//       <motion.div
//         className="fixed z-50 pointer-events-none h-2 w-2 rounded-full bg-primary mix-blend-difference"
//         animate={{
//           x: mousePosition.x - 4,
//           y: mousePosition.y - 4,
//         }}
//         transition={{
//           type: "spring",
//           damping: 30,
//           stiffness: 200,
//           mass: 0.1,
//         }}
//       />
//     </>
//   );
// }

"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function CustomCursor({ mousePosition }: { mousePosition: { x: number; y: number } }) {
  const [isHoveringInteractive, setIsHoveringInteractive] = useState(false);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('button, a, [role="button"], input, select, textarea')) {
        setIsHoveringInteractive(true);
      } else {
        setIsHoveringInteractive(false);
      }
    };
    document.addEventListener('mouseover', handleMouseOver);
    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
    };
  }, []);

  // Variants for the outer cursor animation
  const outerVariants = {
    default: {
      x: mousePosition.x - 12,
      y: mousePosition.y - 12,
      scale: 1,
      opacity: 0.3, // Default opacity
      transition: { type: "spring", damping: 30, stiffness: 200, mass: 0.3 }
    },
    hovering: {
      x: mousePosition.x - 12, // Keep position consistent for fade out
      y: mousePosition.y - 12,
      scale: 0, // Scale down to zero
      opacity: 0, // Fade out completely
      transition: { duration: 0.1, ease: "linear" } // Faster transition for disappearance
    }
  };

  // Variants for the inner cursor animation
  const innerVariants = {
    default: {
      x: mousePosition.x - 3,
      y: mousePosition.y - 3,
      scale: 1, // Default scale for inner dot
      transition: { type: "spring", damping: 40, stiffness: 700, mass: 0.1 }
    },
    hovering: {
      x: mousePosition.x - 4, // Center slightly larger dot
      y: mousePosition.y - 4,
      scale: 1.3, // Slightly increase inner dot scale when outer disappears
      transition: { type: "spring", damping: 25, stiffness: 500, mass: 0.1 }
    }
  };

  return (
    <>
      {/* Outer Cursor (Trailing) */}
      <motion.div
        className="fixed z-50 pointer-events-none h-6 w-6 rounded-full bg-primary mix-blend-difference"
        variants={outerVariants}
        animate={isHoveringInteractive ? "hovering" : "default"}
      />
      {/* Inner Cursor (Precise Point) */}
      <motion.div
        className="fixed z-50 pointer-events-none h-[6px] w-[6px] rounded-full bg-primary mix-blend-difference"
        variants={innerVariants}
        animate={isHoveringInteractive ? "hovering" : "default"}
      />
    </>
  );
}