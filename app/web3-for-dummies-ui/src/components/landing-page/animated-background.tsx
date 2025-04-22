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
    const particleCount = 60;
    const connectDistance = 100;
    const mouseRadius = 150;

    // --- Updated Color Palette to Match LandingPage Theme ---
    const colors = [
        "#3b82f6", // blue-500 (Primary Color)
        "#8b5cf6", // purple-500 (Secondary Color)
        "#22d3ee", // cyan-400 (Accent Color)
        "#60a5fa", // blue-400 (Lighter shade of primary)
        "#c084fc", // purple-400 (Lighter shade of secondary)
        // Optional: Add a slightly darker shade if needed
        // "#2563eb", // blue-600
    ];
    // --- End Updated Color Palette ---


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
        this.size = Math.random() * 2.5 + 1;
        this.baseX = Math.random() * 0.2 - 0.1;
        this.baseY = Math.random() * 0.2 - 0.1;
        this.speedX = this.baseX;
        this.speedY = this.baseY;
        this.baseOpacity = Math.random() * 0.5 + 0.3;
        this.opacity = this.baseOpacity;
        this.opacitySpeed = (Math.random() - 0.5) * 0.01;
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        // Twinkling effect
        this.opacity += this.opacitySpeed;
        if (this.opacity <= 0.2 || this.opacity >= this.baseOpacity + 0.1) {
          this.opacitySpeed *= -1;
          this.opacity = Math.max(0.2, Math.min(this.baseOpacity + 0.1, this.opacity));
        }

        // Mouse interaction logic
        let dxMouse = 0;
        let dyMouse = 0;
        let distanceMouse = Infinity;
        const currentMousePos = mousePosition;

        if (currentMousePos.x !== null && currentMousePos.y !== null) {
          dxMouse = this.x - currentMousePos.x;
          dyMouse = this.y - currentMousePos.y;
          distanceMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
        }

        if (distanceMouse < mouseRadius && distanceMouse > 0) {
          const forceDirectionX = dxMouse / distanceMouse;
          const forceDirectionY = dyMouse / distanceMouse;
          const force = (mouseRadius - distanceMouse) / mouseRadius;
          const pushStrength = 2.5;
          const directionX = forceDirectionX * force * pushStrength;
          const directionY = forceDirectionY * force * pushStrength;
          this.speedX = this.baseX + directionX;
          this.speedY = this.baseY + directionY;
        } else {
           const returnFactor = 0.02;
           this.speedX += (this.baseX - this.speedX) * returnFactor;
           this.speedY += (this.baseY - this.speedY) * returnFactor;
        }

        // Movement and boundary check
        this.x += this.speedX;
        this.y += this.speedY;
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
        if (hex.startsWith('#')) {
            hex = hex.substring(1);
        }
        if (hex.length == 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length == 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
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
                    ctx.strokeStyle = hexToRgba(particles[i].color, opacity * 0.25);
                    ctx.lineWidth = 0.4;
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

  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10 bg-transparent" />;
}