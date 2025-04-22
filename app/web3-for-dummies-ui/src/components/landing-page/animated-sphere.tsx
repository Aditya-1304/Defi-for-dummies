"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function AnimatedSphere() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      setMousePosition({
        x: (clientX - centerX) / 50,
        y: (clientY - centerY) / 50,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="relative w-[550px] h-[550px]">
      {/* Main sphere */}
      <motion.div
        className=" absolute inset-0 rounded-full bg-gradient-to-bl from-purple-600/70 via-blue-500/50 to-cyan-400/30 blur-3xl"
        animate={{
          scale: [1, 1.05, 1],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 25,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
        style={{
          x: mousePosition.x,
          y: mousePosition.y,
        }}
      />

      {/* Floating orbs */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-16 h-16 rounded-full bg-cyan-400/40 blur-lg"
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 10 + i * 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: i * 0.5,
          }}
          style={{
            left: `${20 + i * 15}%`,
            top: `${30 + i * 10}%`,
          }}
        />
      ))}

      {/* Glowing ring */}
      <motion.div
        className="absolute inset-12 rounded-full border border-purple-500/30"
        animate={{
          rotate: [0, 360],
          scale: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 15,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      />

      {/* Inner core */}
      <motion.div
        className="absolute inset-24 rounded-full bg-gradient-radial from-white/30 via-blue-300/20 to-transparent blur-sm"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 8,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
        style={{
          x: mousePosition.x * -1,
          y: mousePosition.y * -1,
        }}
      />
    </div>
  );
}
// "use client";

// import { motion } from "framer-motion";
// import { useEffect, useState } from "react";

// export function AnimatedSphere() {
//   const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

//   useEffect(() => {
//     const handleMouseMove = (e: MouseEvent) => {
//       const { clientX, clientY } = e;
//       const centerX = window.innerWidth / 2;
//       const centerY = window.innerHeight / 2;
//       // Reduced sensitivity to mouse movement
//       setMousePosition({
//         x: (clientX - centerX) / 50, // Was / 50
//         y: (clientY - centerY) / 50, // Was / 50
//       });
//     };

//     window.addEventListener("mousemove", handleMouseMove);
//     return () => window.removeEventListener("mousemove", handleMouseMove);
//   }, []);

//   return (
//     // Adjusted size and margin if needed
//     <div className="relative w-[550px] h-[550px]"> {/* Slightly smaller */}
//       {/* Main sphere - Changed gradient and animation */}
//       <motion.div
//         className="absolute inset-0 rounded-full bg-gradient-to-bl from-purple-600/70 via-blue-500/50 to-cyan-400/30 blur-3xl" // New gradient, increased blur
//         animate={{
//           scale: [1, 1.05, 1], // Subtle scale
//           rotate: [0, -360], // Reverse rotation
//         }}
//         transition={{
//           duration: 25, // Slower duration
//           repeat: Number.POSITIVE_INFINITY,
//           ease: "linear",
//         }}
//         style={{
//           x: mousePosition.x,
//           y: mousePosition.y,
//         }}
//       />

//       {/* Floating orbs - Changed color, animation, and count */}
//       {[...Array(4)].map((_, i) => ( // Reduced to 4 orbs
//         <motion.div
//           key={i}
//           className="absolute w-16 h-16 rounded-full bg-cyan-400/40 blur-lg" // Changed color, reduced size/blur slightly
//           animate={{
//             // More dynamic movement
//             x: [Math.random() * 100 - 50, Math.random() * 200 - 100, Math.random() * 100 - 50],
//             y: [Math.random() * 100 - 50, Math.random() * 200 - 100, Math.random() * 100 - 50],
//             scale: [0.8, 1.3, 0.8], // More pronounced scale change
//           }}
//           transition={{
//             duration: 8 + i * 3, // Adjusted duration and staggering
//             repeat: Number.POSITIVE_INFINITY,
//             ease: "easeInOut",
//             delay: i * 0.8, // Adjusted delay
//           }}
//           style={{
//             // Adjusted positioning logic slightly
//             left: `${15 + i * 20}%`,
//             top: `${25 + i * 15}%`,
//             // Add subtle mouse follow effect to orbs
//             translateX: mousePosition.x * 0.5,
//             translateY: mousePosition.y * 0.5,
//           }}
//         />
//       ))}

//       {/* Glowing ring - Changed color and animation */}
//       <motion.div
//         className="absolute inset-12 rounded-full border border-purple-500/30" // Thinner border, different color
//         animate={{
//           rotate: [360, 0], // Reverse rotation
//           scale: [0.9, 1.05, 0.9], // Different scale pattern
//         }}
//         transition={{
//           duration: 18, // Adjusted duration
//           repeat: Number.POSITIVE_INFINITY,
//           ease: "easeInOut", // Changed ease
//         }}
//       />

//       {/* Inner core - Changed gradient and animation */}
//       <motion.div
//         className="absolute inset-24 rounded-full bg-gradient-radial from-white/30 via-blue-300/20 to-transparent blur-sm" // Radial gradient, different colors, less blur
//         animate={{
//           scale: [1, 1.08, 1], // Adjusted scale
//           opacity: [0.6, 0.9, 0.6], // Adjusted opacity
//         }}
//         transition={{
//           duration: 10, // Adjusted duration
//           repeat: Number.POSITIVE_INFINITY,
//           ease: "easeInOut",
//         }}
//         style={{
//           // Stronger counter-movement to mouse
//           x: mousePosition.x * -1.5,
//           y: mousePosition.y * -1.5,
//         }}
//       />
//     </div>
//   );
// }