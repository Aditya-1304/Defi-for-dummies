// "use client";

// import { motion, useScroll, useTransform } from "framer-motion";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { ArrowRight, CheckCircle2, ChevronRight, Sparkles, Star, Zap, ArrowUpRight } from "lucide-react";
// import { useRef, useState, useEffect } from "react";

// import { AnimatedCounter } from "@/components/landing-page/animated-counter";
// import { AnimatedBackground } from "@/components/landing-page/animated-background";
// import { CustomCursor } from "@/components/landing-page/custom-cursor";
// import { FloatingNav } from "@/components/landing-page/floating-nav";
// import { TextReveal } from "@/components/landing-page/text-reveal";
// import { useRouter } from "next/navigation";
// import { MagneticButton } from "./magnetic-button";
// import { AnimatedSphere } from "@/components/landing-page/animated-sphere";

// export function LandingPage() {
//   const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
//   const targetRef = useRef<HTMLDivElement>(null);
//   const { scrollYProgress } = useScroll({
//     target: targetRef,
//     offset: ["start start", "end start"],
//   });
//   const router = useRouter();

//   const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
//   const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);
//   const y = useTransform(scrollYProgress, [0, 0.5], [0, -100]);

//   useEffect(() => {
//     const handleMouseMove = (e: MouseEvent) => {
//       setMousePosition({ x: e.clientX, y: e.clientY });
//     };
//     window.addEventListener("mousemove", handleMouseMove);
//     return () => window.removeEventListener("mousemove", handleMouseMove);
//   }, []);

//   return (
//     <div className=" min-h-screen overflow-hidden w-full">
//       <CustomCursor mousePosition={mousePosition} />
//       <FloatingNav />
//       <AnimatedBackground />

//       {/* Hero Section */}
//       <section ref={targetRef} className="relative min-h-screen w-full">
//         <div className="relative min-h-screen flex items-center justify-between gap-4 py-24 md:py-32 w-full">
//           <motion.div className="relative z-10 max-w-2xl ml-20" style={{ opacity, scale, y }}>
//             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
//               <Badge className="mb-4" variant="secondary">
//                 🚀 The Future of DeFi is Here
//               </Badge>
//             </motion.div>
//             <TextReveal text="Revolutionize Your DeFi Journey" />
//             <TextReveal
//               text="with AI-Powered Insights"
//               className="bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent"
//               delay={0.2}
//             />
//             <motion.p
//               className="mt-6 text-xl text-muted-foreground"
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.5, delay: 0.4 }}
//             >
//               Navigate the complexities of decentralized finance with confidence. Let our AI guide you to smarter investment decisions.
//             </motion.p>
//             <motion.div
//               className="mt-8 flex flex-wrap items-center gap-4"
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.5, delay: 0.6 }}
//             >
//               <MagneticButton>
//                 <Button size="lg" className="h-12 px-8 text-lg" onClick={() => router.push("/chat")}>
//                   Get Started
//                   <ArrowRight className="ml-2 h-5 w-5" />
//                 </Button>
//               </MagneticButton>
//               <MagneticButton>
//                 <Button variant="outline" size="lg" className="h-12 px-8 text-lg" onClick={() => router.push("/dashboard")}>
//                   Dashboard
//                   <ChevronRight className="ml-2 h-5 w-5" />
//                 </Button>
//               </MagneticButton>
//             </motion.div>
//           </motion.div>
//           <motion.div
//             className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] hidden lg:block"
//             initial={{ opacity: 0, scale: 0.8 }}
//             animate={{ opacity: 1, scale: 1 }}
//             transition={{ duration: 1, delay: 0.2 }}
//           >
//             {/* <Scene /> */}
//             <AnimatedSphere />
//           </motion.div>
//         </div>
//       </section>

//       {/* Stats Section */}
//       <section className="py-20 border-t border-b bg-gradient-to-b from-background/50 to-background">
//         <div className="w-full">
//           <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
//             {stats.map((stat, index) => (
//               <motion.div
//                 key={stat.label}
//                 className="text-center"
//                 initial={{ opacity: 0, y: 20 }}
//                 whileInView={{ opacity: 1, y: 0 }}
//                 transition={{ duration: 0.5, delay: index * 0.1 }}
//                 viewport={{ once: true }}
//               >
//                 <div className="text-4xl font-bold tracking-tight">
//                   <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
//                 </div>
//                 <div className="mt-2 text-muted-foreground">{stat.label}</div>
//               </motion.div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* Features Section */}
//       <section id="features" className="w-full py-24 sm:py-32">
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           whileInView={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.5 }}
//           viewport={{ once: true }}
//           className="text-center"
//         >
//           <TextReveal text="Powerful Features for Smart Investing" className="text-3xl font-bold tracking-tight md:text-4xl" />
//           <p className="mt-4 text-xl text-muted-foreground">Everything you need to succeed in DeFi</p>
//         </motion.div>
//         <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
//           {features.map((feature, index) => (
//             <motion.div
//               key={feature.title}
//               initial={{ opacity: 0, y: 20 }}
//               whileInView={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.5, delay: index * 0.1 }}
//               viewport={{ once: true }}
//               whileHover={{ scale: 1.05 }}
//               className="relative group"
//             >
//               <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-primary/50 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
//               <Card className="relative bg-card/50 backdrop-blur-sm">
//                 <CardContent className="p-6">
//                   <div className="flex items-center gap-4">
//                     <div className="relative">
//                       <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
//                       <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
//                         {feature.icon}
//                       </div>
//                     </div>
//                     <div>
//                       <h3 className="font-semibold tracking-tight">{feature.title}</h3>
//                       <p className="text-sm text-muted-foreground">{feature.description}</p>
//                     </div>
//                   </div>
//                 </CardContent>
//               </Card>
//             </motion.div>
//           ))}
//         </div>
//       </section>

//       {/* Testimonials Section */}
//       <section id="testimonials" className="w-full py-24 sm:py-32">
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           whileInView={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.5 }}
//           viewport={{ once: true }}
//           className="text-center"
//         >
//           <TextReveal text="Trusted by DeFi Experts" className="text-3xl font-bold tracking-tight md:text-4xl" />
//           <p className="mt-4 text-xl text-muted-foreground">Join thousands of satisfied users</p>
//         </motion.div>
//         <div className="mt-16">
//           <div className="flex flex-nowrap gap-8 overflow-x-hidden">
//             <motion.div
//               animate={{
//                 x: [0, -2000],
//               }}
//               transition={{
//                 duration: 50,
//                 repeat: Number.POSITIVE_INFINITY,
//                 ease: "linear",
//               }}
//               className="flex gap-8 pr-8"
//             >
//               {[...testimonials, ...testimonials].map((testimonial, index) => (
//                 <Card key={index} className="w-[400px] shrink-0 bg-card/50 backdrop-blur-sm">
//                   <CardContent className="p-6">
//                     <div className="flex items-start gap-4">
//                       <Avatar className="h-12 w-12">
//                         <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
//                         <AvatarFallback>{testimonial.name[0]}</AvatarFallback>
//                       </Avatar>
//                       <div>
//                         <div className="flex items-center gap-2">
//                           <h3 className="font-semibold">{testimonial.name}</h3>
//                           <div className="flex items-center">
//                             {Array(5)
//                               .fill(null)
//                               .map((_, i) => (
//                                 <Star
//                                   key={i}
//                                   className={`h-4 w-4 ${i < testimonial.rating ? "fill-primary text-primary" : "fill-muted text-muted"}`}
//                                 />
//                               ))}
//                           </div>
//                         </div>
//                         <p className="mt-2 text-sm text-muted-foreground">{testimonial.text}</p>
//                       </div>
//                     </div>
//                   </CardContent>
//                 </Card>
//               ))}
//             </motion.div>
//           </div>
//         </div>
//       </section>

//       {/* CTA Section */}
//       <section className="relative border-t">
//         <div className="w-full py-24 sm:py-32">
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.5 }}
//             viewport={{ once: true }}
//             className="relative z-10 flex flex-col items-center gap-4 text-center"
//           >
//             <TextReveal text="Start Your DeFi Journey Today" className="text-3xl font-bold tracking-tight md:text-4xl" />
//             <p className="max-w-[600px] text-xl text-muted-foreground">Join the future of finance with our AI-powered platform</p>
//             <motion.div
//               className="mt-4 flex flex-wrap items-center justify-center gap-4"
//               initial={{ opacity: 0, y: 20 }}
//               whileInView={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.5, delay: 0.2 }}
//               viewport={{ once: true }}
//             >
//               <MagneticButton>
//                 <Button size="lg" className="h-12 px-8 text-lg" onClick={() => router.push("/chat")}>
//                   Get Started Now
//                   <ArrowUpRight className="ml-2 h-5 w-5" />
//                 </Button>
//               </MagneticButton>
//             </motion.div>
//           </motion.div>
//         </div>
//       </section>

//       {/* Footer */}
//       <footer className="border-t">
//         <div className="w-full flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
//           <div className="flex items-center gap-4 px-8 md:px-0">
//             <Sparkles className="h-5 w-5 text-primary" />
//             <p className="text-sm text-muted-foreground">Built with ❤️ for the Solana-DeFi community</p>
//           </div>
//           <div className="flex items-center gap-4">
//             <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
//               Terms
//             </a>
//             <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
//               Privacy
//             </a>
//             <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
//               Contact
//             </a>
//           </div>
//         </div>
//       </footer>
//     </div>
//   );
// }

// const stats = [
//   { value: 50, label: "Active Users", prefix: "$", suffix: "K+" },
//   { value: 2, label: "Total Volume", prefix: "$", suffix: "B+" },
//   { value: 150, label: "Protocols Supported", suffix: "+" },
//   { value: 99, label: "Success Rate", suffix: "%" },
// ];

// const features = [
//   {
//     title: "AI-Powered Insights",
//     description: "Get personalized investment recommendations based on real-time market analysis",
//     icon: <Sparkles className="h-6 w-6 text-primary" />,
//   },
//   {
//     title: "Real-time Analytics",
//     description: "Track your portfolio performance with advanced analytics and visualizations",
//     icon: <Zap className="h-6 w-6 text-primary" />,
//   },
//   {
//     title: "Smart Risk Management",
//     description: "Stay informed about market risks and opportunities with AI predictions",
//     icon: <CheckCircle2 className="h-6 w-6 text-primary" />,
//   },
// ];

// const testimonials = [
//   {
//     name: "Alex Thompson",
//     avatar: "/placeholder.svg?height=40&width=40",
//     rating: 5,
//     text: "This platform has completely transformed how I approach DeFi investing. The AI insights are incredibly valuable.",
//   },
//   {
//     name: "Sarah Chen",
//     avatar: "/placeholder.svg?height=40&width=40",
//     rating: 5,
//     text: "As a beginner in DeFi, this tool has been invaluable. It's like having a expert guide by your side.",
//   },
//   {
//     name: "Michael Rodriguez",
//     avatar: "/placeholder.svg?height=40&width=40",
//     rating: 4,
//     text: "The real-time analytics and AI recommendations have helped me make better investment decisions.",
//   },
// ];

"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, CheckCircle2, ChevronRight, Sparkles, Star, Zap, ArrowUpRight, MessageCircle, Send, BarChart2, BrainCircuit, Bot } from "lucide-react"; // Added new icons
import { useRef, useState, useEffect } from "react";

import { AnimatedCounter } from "@/components/landing-page/animated-counter";
import { AnimatedBackground } from "@/components/landing-page/animated-background";
import { CustomCursor } from "@/components/landing-page/custom-cursor";
import { FloatingNav } from "@/components/landing-page/floating-nav";
import { TextReveal } from "@/components/landing-page/text-reveal";
import { useRouter } from "next/navigation";
import { MagneticButton } from "./magnetic-button";
import { AnimatedSphere } from "@/components/landing-page/animated-sphere";

// Define a vibrant color palette (adjust hex codes as needed)
const primaryColor = "text-blue-500"; // Example: Vibrant Blue
const secondaryColor = "text-purple-500"; // Example: Vibrant Purple
const accentColor = "text-cyan-400"; // Example: Vibrant Cyan

export function LandingPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end start"],
  });
  const router = useRouter();

  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, -100]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    // Use a darker base background if desired
    <div className="min-h-screen overflow-hidden w-full text-gray-100 cursor-container">
      {/* Pass updated primary color to cursor if needed, or adjust cursor component directly */}
      <CustomCursor mousePosition={mousePosition} />
      <FloatingNav />
      <AnimatedBackground /> {/* Ensure this background uses desired colors */}

      {/* Hero Section */}
      <section ref={targetRef} className="relative min-h-screen w-full">
        <div className="relative min-h-screen flex items-center justify-between gap-4 py-47 md:py-35 w-full px-4 md:px-8 lg:px-20"> {/* Added padding */}
          <motion.div className="relative z-10 max-w-3xl" style={{ opacity, scale, y }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Badge className={`mb-4 bg-blue-600/20 ${primaryColor} border-blue-600/30 hover:bg-blue-600/30`} variant="secondary">
                <Bot className="mr-2 h-4 w-4" /> Your AI Solana Co-Pilot
              </Badge>
            </motion.div>
            {/* Updated Headline */}
            <TextReveal 
  text="Chat Your Way Through" 
  className={`text-4xl md:text-5xl lg:text-6xl font-bold ${primaryColor} mb-1`} 
/>
<TextReveal 
  text="Solana" 
  className={`text-4xl md:text-5xl lg:text-6xl font-bold ${primaryColor} mb-1`}
  delay={0.1}
/>
<TextReveal
  text="with Your AI Agent"
  className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent pb-2" // Added padding bottom 
  delay={0.2}
/>
            {/* Updated Description */}
            <motion.p
              className="mt-6 text-lg md:text-xl text-gray-400" // Adjusted text color for dark bg
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              Effortlessly manage assets, execute transactions, and gain market insights on Solana using simple chat commands. Let AI handle the complexity.
            </motion.p>
            <motion.div
              className="mt-8 flex flex-wrap items-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <MagneticButton>
                {/* Updated Button Colors */}
                <Button size="lg" className={`h-12 px-8 text-lg bg-blue-600 hover:bg-blue-700 text-white`} onClick={() => router.push("/chat")}>
                  Start Chatting
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </MagneticButton>
              {/* Optional: Link to docs or features instead of dashboard? */}
              <MagneticButton>
                <Button variant="outline" size="lg" className={`h-12 px-8 text-lg border-purple-500/50 ${secondaryColor} hover:bg-purple-500/10 hover:${secondaryColor}`} onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                  Learn More
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </MagneticButton>
            </motion.div>
          </motion.div>
          <motion.div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] lg:w-[600px] lg:h-[600px] hidden lg:block opacity-70" // Adjusted size/opacity
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            <AnimatedSphere /> {/* Ensure sphere uses desired colors */}
          </motion.div>
        </div>
      </section>

      {/* Stats Section - Keep relevant stats */}
      <section className="py-20 border-t border-b border-gray-800/60 bg-gradient-to-b from-gray-850/50 to-gray-900/50"> {/* Darker borders/bg */}
        <div className="w-full max-w-6xl mx-auto px-4"> {/* Added max-width and padding */}
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className={`text-4xl font-bold tracking-tight ${primaryColor}`}>
                  <AnimatedCounter value={stat.value} prefix={stat.prefix || ''} suffix={stat.suffix} />
                </div>
                <div className="mt-2 text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Updated Content */}
      <section id="features" className="w-full py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4"> {/* Added max-width and padding */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <TextReveal text="Your Solana Agent Can..." className={`text-3xl font-bold tracking-tight md:text-4xl ${secondaryColor}`} />
            <p className="mt-4 text-xl text-gray-400">Simplify your Solana experience with AI.</p>
          </motion.div>
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Use updated features array */}
            {updatedFeatures.map((feature, index) => (
              <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.03 }}
              className="relative group interactive" // Add interactive class here
              data-cursor-hide="true" // Explicitly mark for cursor hiding
            >
                {/* Updated gradient highlight */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 via-blue-500 to-cyan-500 rounded-2xl blur opacity-30 group-hover:opacity-70 transition duration-1000 group-hover:duration-200" />
                {/* Darker card background */}
                <Card className="relative bg-gray-900/80 backdrop-blur-sm border border-gray-800/60 h-full"> {/* Ensure consistent height */}
                  <CardContent className="p-6 flex flex-col items-start h-full"> {/* Flex column */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative">
                        {/* Updated icon background */}
                        <div className={`absolute inset-0 ${primaryColor}/20 blur-xl rounded-full`} />
                        <div className={`relative flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 ring-1 ring-blue-500/25`}>
                          {feature.icon}
                        </div>
                      </div>
                      <h3 className="font-semibold tracking-tight text-lg text-gray-100">{feature.title}</h3>
                    </div>
                    <p className="text-sm text-gray-400 flex-grow">{feature.description}</p> {/* flex-grow */}
                    {feature.isVision && (
                       <Badge variant="outline" className="mt-4 text-xs border-purple-500/50 text-purple-400">Vision</Badge>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section - Updated Content */}
      <section id="testimonials" className="w-full py-24 sm:py-32 overflow-hidden"> {/* Added overflow-hidden */}
         <div className="max-w-6xl mx-auto px-4"> {/* Added max-width and padding */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <TextReveal text="What Users Are Saying" className={`text-3xl font-bold tracking-tight md:text-4xl ${accentColor}`} />
              <p className="mt-4 text-xl text-gray-400">Hear from the growing community.</p>
            </motion.div>
         </div>
        <div className="mt-16">
          {/* Marquee Effect */}
          <div className="flex flex-nowrap gap-8 overflow-x-hidden [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]">
            <motion.div
              animate={{ x: ["0%", "-100%"] }} // Animate translateX from 0% to -100%
              transition={{ duration: 60, repeat: Infinity, ease: "linear" }} // Adjust duration for speed
              className="flex gap-8 pr-8 flex-shrink-0" // Add flex-shrink-0
            >
              {/* Duplicate testimonials for seamless loop */}
              {[...updatedTestimonials, ...updatedTestimonials].map((testimonial, index) => (
                <Card key={`t1-${index}`} className="w-[350px] md:w-[400px] shrink-0 bg-gray-900/70 backdrop-blur-sm border border-gray-800/60"> {/* Darker card */}
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                        <AvatarFallback className="bg-blue-800 text-blue-200">{testimonial.name.split(' ').map(n => n[0]).join('')}</AvatarFallback> {/* Initials Fallback */}
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-100">{testimonial.name}</h3>
                          {/* Star rating with vibrant color */}
                          <div className="flex items-center">
                            {Array(5).fill(null).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${i < testimonial.rating ? `fill-yellow-400 text-yellow-400` : "fill-gray-700 text-gray-700"}`}
                                />
                              ))}
                          </div>
                        </div>
                         <p className="text-xs text-gray-500 mt-1">{testimonial.title || "Solana User"}</p> {/* Optional Title */}
                        <p className="mt-3 text-sm text-gray-400">{testimonial.text}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
             {/* Second identical div for seamless loop */}
             <motion.div
              animate={{ x: ["0%", "-100%"] }}
              transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
              className="flex gap-8 pr-8 flex-shrink-0"
              aria-hidden="true" // Hide second div from screen readers
            >
              {[...updatedTestimonials, ...updatedTestimonials].map((testimonial, index) => (
                 <Card key={`t2-${index}`} className="w-[350px] md:w-[400px] shrink-0 bg-gray-900/70 backdrop-blur-sm border border-gray-800/60">
                   <CardContent className="p-6">
                     {/* ... testimonial content identical to above ... */}
                      <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                        <AvatarFallback className="bg-blue-800 text-blue-200">{testimonial.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-100">{testimonial.name}</h3>
                          <div className="flex items-center">
                            {Array(5).fill(null).map((_, i) => (
                                <Star key={i} className={`h-4 w-4 ${i < testimonial.rating ? `fill-yellow-400 text-yellow-400` : "fill-gray-700 text-gray-700"}`} /> ))}
                          </div>
                        </div>
                         <p className="text-xs text-gray-500 mt-1">{testimonial.title || "Solana User"}</p>
                        <p className="mt-3 text-sm text-gray-400">{testimonial.text}</p>
                      </div>
                    </div>
                   </CardContent>
                 </Card>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative border-t border-gray-800/60">
        <div className="w-full max-w-4xl mx-auto px-4 py-24 sm:py-32"> {/* Added max-width and padding */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="relative z-10 flex flex-col items-center gap-4 text-center"
          >
            <TextReveal text="Ready to Simplify Solana?" className={`text-3xl font-bold tracking-tight md:text-4xl ${primaryColor}`} />
            <p className="max-w-[600px] text-lg md:text-xl text-gray-400">Talk to your AI agent and experience the future of blockchain interaction.</p>
            <motion.div
              className="mt-4 flex flex-wrap items-center justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <MagneticButton>
                {/* Updated Button Colors */}
                <Button size="lg" className={`h-12 px-8 text-lg bg-blue-600 hover:bg-blue-700 text-white`} onClick={() => router.push("/chat")}>
                  Chat Now
                  <ArrowUpRight className="ml-2 h-5 w-5" />
                </Button>
              </MagneticButton>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/60 bg-gray-950"> {/* Darker footer */}
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center justify-between gap-4 py-8 md:flex-row px-4"> {/* Added max-width and padding */}
          <div className="flex items-center gap-3 px-8 md:px-0">
            <Bot className={`h-5 w-5 ${primaryColor}`} /> {/* Use Bot icon */}
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} AI Solana Agent. All rights reserved.</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Add relevant links if applicable */}
            <a href="#" className="text-sm text-gray-500 hover:text-blue-400 transition-colors">
              Terms
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-blue-400 transition-colors">
              Privacy
            </a>
            {/* <a href="#" className="text-sm text-gray-500 hover:text-blue-400 transition-colors">
              Contact
            </a> */}
          </div>
        </div>
      </footer>
    </div>
  );
}

// Keep relevant stats
const stats = [
  { value: 100000, label: "Transactions Processed", prefix: "", suffix: "+" },
  { value: 1000, label: "Active Users", prefix: "", suffix: "+" },
  { value: 10, label: "Integrations (Vision)", prefix: "", suffix: "+" }, // Example future stat
  { value: 98, label: "Command Success Rate", prefix: "", suffix: "%" },
];

// Updated Features reflecting AI Agent capabilities
const updatedFeatures = [
  {
    title: "Natural Language Transactions",
    description: "Send tokens, swap assets, and check balances just by telling the AI what you want to do.",
    icon: <Send className={`h-6 w-6 ${primaryColor}`} />,
    isVision: false,
  },
  {
    title: "Portfolio Overview",
    description: "Get a clear picture of your Solana assets across different tokens and protocols via chat.",
    icon: <BarChart2 className={`h-6 w-6 ${primaryColor}`} />,
    isVision: false,
  },
  {
    title: "Token Information",
    description: "Ask the AI for details about specific Solana tokens, including price, market cap, and description.",
    icon: <MessageCircle className={`h-6 w-6 ${primaryColor}`} />,
    isVision: false,
  },
   {
    title: "AI Staking & Yield Insights",
    description: "Discover potential staking opportunities and yield farming strategies based on AI analysis. (Coming Soon)",
    icon: <BrainCircuit className={`h-6 w-6 ${secondaryColor}`} />, // Use secondary color for vision
    isVision: true, // Mark as vision
  },
   {
    title: "Automated DeFi Actions",
    description: "Set up automated tasks like DCA or limit orders through simple instructions. (Coming Soon)",
    icon: <Zap className={`h-6 w-6 ${secondaryColor}`} />, // Use secondary color for vision
    isVision: true, // Mark as vision
  },
  {
    title: "Context-Aware Assistance",
    description: "The AI remembers your previous interactions to provide more relevant and helpful responses.",
    icon: <Bot className={`h-6 w-6 ${primaryColor}`} />,
    isVision: false,
  },
];

// Updated and Expanded Testimonials
const updatedTestimonials = [
  {
    name: "Alex Thompson",
    title: "DeFi Trader",
    avatar: "/placeholder-user.jpg", // Use generic placeholders or update paths
    rating: 5,
    text: "Finally, a way to interact with Solana that doesn't require complex UIs. Just telling the AI 'swap 0.5 SOL for JUP' is a game-changer.",
  },
  {
    name: "Sarah Chen",
    title: "Solana Newbie",
    avatar: "/placeholder-user.jpg",
    rating: 5,
    text: "As someone new to Solana, this AI agent made everything so much less intimidating. Checking my balance and sending tokens is super easy now.",
  },
  {
    name: "Michael Rodriguez",
    title: "Yield Farmer",
    avatar: "/placeholder-user.jpg",
    rating: 4,
    text: "The portfolio overview is helpful. Excited for the upcoming AI staking insights – that could save me hours of research.",
  },
   {
    name: "Emily White",
    title: "NFT Collector",
    avatar: "/placeholder-user.jpg",
    rating: 5,
    text: "I mainly use it for quick balance checks and sending SOL between wallets. It's incredibly fast and reliable for basic tasks.",
  },
   {
    name: "David Lee",
    title: "Blockchain Developer",
    avatar: "/placeholder-user.jpg",
    rating: 4,
    text: "Interesting application of AI on Solana. The natural language processing for transactions works surprisingly well. Looking forward to API access.",
  },
   {
    name: "Jessica Green",
    title: "Crypto Enthusiast",
    avatar: "/placeholder-user.jpg",
    rating: 5,
    text: "This is the future! Managing my Solana assets through chat feels so intuitive. Can't wait to see more features added.",
  },
];
