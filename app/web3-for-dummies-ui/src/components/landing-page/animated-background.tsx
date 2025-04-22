// "use client";

// import { useEffect, useRef } from "react";

// export function AnimatedBackground() {
//   const canvasRef = useRef<HTMLCanvasElement>(null);

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;

//     const ctx = canvas.getContext("2d");
//     if (!ctx) return;

//     let animationFrameId: number;
//     let particles: Particle[] = [];
//     const particleCount = 50;

//     class Particle {
//       x: number;
//       y: number;
//       size: number;
//       speedX: number;
//       speedY: number;
//       opacity: number;

//       constructor() {
//         this.x = Math.random() * canvas!.width;
//         this.y = Math.random() * canvas!.height;
//         this.size = Math.random() * 5;
//         this.speedX = Math.random() * 0.7 - 0.25;
//         this.speedY = Math.random() * 0.7 - 0.25;
//         this.opacity = Math.random() * 1;
//       }

//       update() {
//         this.x += this.speedX;
//         this.y += this.speedY;

//         if (this.x > canvas!.width) this.x = 0;
//         if (this.x < 0) this.x = canvas!.width;
//         if (this.y > canvas!.height) this.y = 0;
//         if (this.y < 0) this.y = canvas!.height;
//       }

//       draw() {
//         if (!ctx) return;
//         ctx.fillStyle = `rgba(100, 100, 255, ${this.opacity})`;
//         ctx.beginPath();
//         ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
//         ctx.fill();
//       }
//     }

//     function init() {
//       particles = [];
//       for (let i = 0; i < particleCount; i++) {
//         particles.push(new Particle());
//       }
//     }

//     function animate() {
//       if (!ctx || !canvas) return;
//       ctx.clearRect(0, 0, canvas.width, canvas.height);

//       particles.forEach((particle) => {
//         particle.update();
//         particle.draw();
//       });

//       animationFrameId = requestAnimationFrame(animate);
//     }

//     function handleResize() {
//       if (!canvas) return;
//       canvas.width = window.innerWidth;
//       canvas.height = window.innerHeight;
//       init();
//     }

//     handleResize();
//     window.addEventListener("resize", handleResize);
//     animate();

//     return () => {
//       window.removeEventListener("resize", handleResize);
//       cancelAnimationFrame(animationFrameId);
//     };
//   }, []);

//   return <canvas ref={canvasRef} className="fixed inset-0 -z-10 bg-transparent" />;
// }

"use client";

import { useEffect, useRef, useState } from "react";

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const particleCount = 50; // Reduced count slightly due to larger size
    const connectDistance = 120; // Slightly increased connect distance
    const mouseRadius = 150; // Increased mouse interaction radius

    const colors = ["#8A2BE2", "#4682B4", "#00CED1", "#ADD8E6", "#E0FFFF"];

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      baseOpacity: number;
      opacity: number;
      opacitySpeed: number;
      color: string;
      baseX: number;
      baseY: number;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.size = Math.random() * 5 + 1.5; // Increased size range: 1.5 to 4.5
        this.baseX = Math.random() * 0.2 - 0.1; // Significantly slower base speed X (-0.1 to 0.1)
        this.baseY = Math.random() * 0.2 - 0.1; // Significantly slower base speed Y (-0.1 to 0.1)
        this.speedX = this.baseX;
        this.speedY = this.baseY;
        this.baseOpacity = Math.random() * 0.4 + 0.2; // Adjusted opacity range: 0.2 to 0.6
        this.opacity = this.baseOpacity;
        this.opacitySpeed = (Math.random() - 0.5) * 0.01; // Slower twinkling speed
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        // Twinkling effect
        this.opacity += this.opacitySpeed;
        if (this.opacity <= 0.1 || this.opacity >= this.baseOpacity + 0.1) { // Reduced twinkle range slightly
          this.opacitySpeed *= -1;
          this.opacity = Math.max(0.1, Math.min(this.baseOpacity + 0.1, this.opacity));
        }

        // Mouse interaction
        let dxMouse = 0;
        let dyMouse = 0;
        let distanceMouse = Infinity;
        const currentMousePos = mousePosition; // Capture state for this frame

        if (currentMousePos.x !== null && currentMousePos.y !== null) {
          dxMouse = this.x - currentMousePos.x;
          dyMouse = this.y - currentMousePos.y;
          distanceMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
        }

        // Check if within radius AND distance is not zero (avoid division by zero)
        if (distanceMouse < mouseRadius && distanceMouse > 0) {
          const forceDirectionX = dxMouse / distanceMouse;
          const forceDirectionY = dyMouse / distanceMouse;
          // Make force stronger closer to the mouse, increase overall push strength significantly
          const force = (mouseRadius - distanceMouse) / mouseRadius;
          const pushStrength = 2.5; // <--- INCREASED PUSH STRENGTH (was 1.0)
          const directionX = forceDirectionX * force * pushStrength;
          const directionY = forceDirectionY * force * pushStrength;

          // Apply the push force, adding to base speed
          this.speedX = this.baseX + directionX;
          this.speedY = this.baseY + directionY;

          // Optional: Add console log here for debugging
          // console.log(`Pushing particle: dx=${directionX.toFixed(2)}, dy=${directionY.toFixed(2)}, speedX=${this.speedX.toFixed(2)}, speedY=${this.speedY.toFixed(2)}`);

        } else {
          // Return to base speed more slowly - ensure this doesn't completely negate the push
           const returnFactor = 0.02; // <--- Slightly faster return (was 0.01)
           this.speedX += (this.baseX - this.speedX) * returnFactor;
           this.speedY += (this.baseY - this.speedY) * returnFactor;

           // Clamp speed to prevent excessive drifting after push (optional)
           // const maxSpeed = 0.5;
           // this.speedX = Math.max(-maxSpeed, Math.min(maxSpeed, this.speedX));
           // this.speedY = Math.max(-maxSpeed, Math.min(maxSpeed, this.speedY));
        }

        // Movement and boundary check
        this.x += this.speedX;
        this.y += this.speedY;

        // Smoother boundary wrapping
        if (this.x > canvas!.width + this.size * 2) this.x = -this.size * 2;
        if (this.x < -this.size * 2) this.x = canvas!.width + this.size * 2;
        if (this.y > canvas!.height + this.size * 2) this.y = -this.size * 2;
        if (this.y < -this.size * 2) this.y = canvas!.height + this.size * 2;
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = hexToRgba(this.color, this.opacity);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function hexToRgba(hex: string, alpha: number): string {
        let r = 0, g = 0, b = 0;
        if (hex.length == 4) {
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length == 7) {
            r = parseInt(hex.substring(1, 3), 16);
            g = parseInt(hex.substring(3, 5), 16);
            b = parseInt(hex.substring(5, 7), 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function connectParticles() {
        if (!ctx) return;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < connectDistance) {
                    const opacity = 1 - distance / connectDistance;
                    // Make lines even fainter
                    ctx.strokeStyle = hexToRgba(particles[i].color, opacity * 0.15); // Reduced line opacity multiplier (was 0.3)
                    ctx.lineWidth = 0.3; // Thinner lines (was 0.5)
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    function init() {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });

      connectParticles();

      animationFrameId = requestAnimationFrame(animate);
    }

    function handleResize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    }

    const handleMouseMove = (event: MouseEvent) => {
        setMousePosition({ x: event.clientX, y: event.clientY });
    };
    const handleMouseLeave = () => {
        setMousePosition({ x: null, y: null });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []); // Removed mousePosition dependency - it causes re-renders, state is read directly in effect

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10 bg-transparent" />;
}