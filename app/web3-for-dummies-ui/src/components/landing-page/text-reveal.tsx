// "use client";

// import { motion } from "framer-motion";

// export function TextReveal({ text, className = "text-4xl font-bold", delay = 0 }: { text: string; className?: string; delay?: number }) {
//   const words = text.split(" ");

//   const container = {
//     hidden: { opacity: 0 },
//     visible: (i = 1) => ({
//       opacity: 1,
//       transition: { staggerChildren: 0.12, delayChildren: delay },
//     }),
//   };

//   const child = {
//     visible: {
//       opacity: 1,
//       y: 0,
//       transition: {
//         type: "spring",
//         damping: 12,
//         stiffness: 100,
//       },
//     },
//     hidden: {
//       opacity: 0,
//       y: 20,
//       transition: {
//         type: "spring",
//         damping: 12,
//         stiffness: 100,
//       },
//     },
//   };

//   return (
//     <motion.h2 className={className} variants={container} initial="hidden" whileInView="visible" viewport={{ once: true }}>
//       {words.map((word, index) => (
//         <motion.span variants={child} key={index} className="inline-block mr-[0.25em] last:mr-0">
//           {word}
//         </motion.span>
//       ))}
//     </motion.h2>
//   );
// }

"use client";

import { motion } from "framer-motion";

export function TextReveal({ text, className = "text-4xl font-bold", delay = 0 }: { text: string; className?: string; delay?: number }) {
  // Split text into letters, preserving spaces
  const letters = Array.from(text);

  const container = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.03, delayChildren: delay }, // Faster stagger for letters
    }),
  };

  const child = {
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 15, // Slightly adjusted damping
        stiffness: 200, // Slightly adjusted stiffness
      },
    },
    hidden: {
      opacity: 0,
      y: 10, // Reduced initial offset
      transition: {
        type: "spring",
        damping: 15,
        stiffness: 200,
      },
    },
  };

  return (
    <motion.h2
      className={className}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      aria-label={text} // Add aria-label for accessibility
    >
      {letters.map((letter, index) => (
        <motion.span
          variants={child}
          key={`${letter}-${index}`}
          className="inline-block" // Each letter is a block
          style={{ whiteSpace: 'pre' }} // Preserve spaces
        >
          {letter}
        </motion.span>
      ))}
    </motion.h2>
  );
}
