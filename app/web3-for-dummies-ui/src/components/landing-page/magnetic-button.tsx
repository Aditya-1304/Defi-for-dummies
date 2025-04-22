// "use client";

// import type React from "react";

// import { motion } from "framer-motion";
// import { useRef, useState } from "react";

// export function MagneticButton({ children }: { children: React.ReactNode }) {
//   const ref = useRef<HTMLDivElement>(null);
//   const [position, setPosition] = useState({ x: 0, y: 0 });

//   const handleMouse = (event: React.MouseEvent<HTMLDivElement>) => {
//     const { clientX, clientY } = event;
//     const { height, width, left, top } = ref.current?.getBoundingClientRect() ?? {
//       height: 0,
//       width: 0,
//       left: 0,
//       top: 0,
//     };

//     const middleX = clientX - (left + width / 2);
//     const middleY = clientY - (top + height / 2);

//     setPosition({ x: middleX * 0.1, y: middleY * 0.1 });
//   };

//   const reset = () => {
//     setPosition({ x: 0, y: 0 });
//   };

//   const { x, y } = position;

//   return (
//     <motion.div
//       ref={ref}
//       onMouseMove={handleMouse}
//       onMouseLeave={reset}
//       animate={{ x, y }}
//       transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
//     >
//       {children}
//     </motion.div>
//   );
// }

"use client";

import type React from "react";

import { motion } from "framer-motion";
import { useRef, useState } from "react";

export function MagneticButton({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (event: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = event;
    const { height, width, left, top } = ref.current?.getBoundingClientRect() ?? {
      height: 0,
      width: 0,
      left: 0,
      top: 0,
    };

    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);

    // Increased strength multiplier for a stronger pull
    setPosition({ x: middleX * 0.15, y: middleY * 0.15 }); // Was 0.1
  };

  const reset = () => {
    setPosition({ x: 0, y: 0 });
  };

  const { x, y } = position;

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x, y }}
      className="magnetic-button" // Add this class
      data-cursor-hide="true"
      // Adjusted spring physics for a slightly quicker, more controlled feel
      transition={{ type: "spring", stiffness: 250, damping: 20, mass: 0.1 }} // stiffness: 150 -> 250, damping: 15 -> 20
    >
      {children}
    </motion.div>
  );
}
