"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function CustomCursor({ mousePosition }: { mousePosition: { x: number; y: number } }) {
  const [isHoveringInteractive, setIsHoveringInteractive] = useState(false);

  useEffect(() => {
    // More aggressive approach - use a direct mousemove handler to check what's under the cursor
    const handleMouseMove = (e: MouseEvent) => {
      const element = document.elementFromPoint(e.clientX, e.clientY);
      
      // Check if we're over any interactive element
      if (element) {
        // Check if explicitly marked non-interactive
        if (element.closest('[data-cursor-hide="false"]')) {
          setIsHoveringInteractive(false);
          return;
        }
        
        // Check if any interactive element or explicitly marked
        const isInteractive = !!element.closest(
          'button, a, [role="button"], input, select, textarea, .interactive, [data-cursor-hide="true"], .motion-div, .group, ' + 
          '.card, .badge, svg, .btn, .clickable, .card-content, .magnetic-button'
        );
        
        setIsHoveringInteractive(isInteractive);
      }
    };
    
    // Use a throttled version for performance
    let lastExec = 0;
    const throttledHandler = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastExec > 40) { // ~25 frames per second check
        lastExec = now;
        handleMouseMove(e);
      }
    };

    document.addEventListener('mousemove', throttledHandler);
    
    return () => {
      document.removeEventListener('mousemove', throttledHandler);
    };
  }, []);

  // Animation variants with smoother transitions
  const outerVariants = {
    default: {
      x: mousePosition.x - 12,
      y: mousePosition.y - 12,
      scale: 1,
      opacity: 0.3,
      transition: { type: "spring", damping: 60, stiffness: 500, mass: 0.5 }
    },
    hovering: {
      x: mousePosition.x - 12,
      y: mousePosition.y - 12,
      scale: 0,
      opacity: 0,
      transition: { duration: 0.15, ease: "easeOut" }
    }
  };

  const innerVariants = {
    default: {
      x: mousePosition.x - 3,
      y: mousePosition.y - 3,
      scale: 1,
      opacity: 1,
      transition: { type: "spring", damping: 70, stiffness: 700, mass: 0.2 }
    },
    hovering: {
      x: mousePosition.x - 4,
      y: mousePosition.y - 4,
      scale: 0,
      opacity: 0,
      transition: { duration: 0.15, ease: "easeOut" }
    }
  };

  const cursorBaseClasses = "fixed z-[9999] pointer-events-none rounded-full bg-blue-500 mix-blend-difference";

  return (
    <>
      {/* Outer Cursor */}
      <motion.div
        className={`${cursorBaseClasses} h-6 w-6`}
        variants={outerVariants}
        animate={isHoveringInteractive ? "hovering" : "default"}
      />
      {/* Inner Cursor */}
      <motion.div
        className={`${cursorBaseClasses} h-[6px] w-[6px]`}
        variants={innerVariants}
        animate={isHoveringInteractive ? "hovering" : "default"}
      />
    </>
  );
}