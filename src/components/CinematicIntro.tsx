"use client";

import { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  phase: number;
}

export default function CinematicIntro({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completeCalledRef = useRef(false);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let frameCount = 0;
    let particles: Particle[] = [];

    const initParticles = () => {
      particles = [];
      const particleCount = Math.min(Math.floor(width * 0.14), 220);
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          alpha: 0,
          size: Math.random() * 1.8 + 0.8,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      initParticles();
    };

    window.addEventListener("resize", resize);
    resize();

    const render = () => {
      frameCount += 1;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, width, height);

      particles.forEach((p, i) => {
        if (frameCount < 96) {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha = Math.min(p.alpha + 0.012, 0.46 + Math.sin(frameCount * 0.05 + p.phase) * 0.18);
        } else if (frameCount < 245) {
          const dx = centerX - p.x;
          const dy = centerY - p.y;
          p.x += dx * 0.022;
          p.y += dy * 0.022;
          p.alpha = 0.82;
          p.x += Math.sin(frameCount * 0.1 + i) * 1.8;
        } else if (frameCount < 300) {
          const dx = centerX - p.x;
          const dy = centerY - p.y;
          p.x += dx * 0.16;
          p.y += dy * 0.16;
          p.alpha = 1;
          p.size = Math.max(0.45, p.size * 0.95);
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        const isCyan = i % 2 === 0;
        ctx.fillStyle = `rgba(${isCyan ? "34, 211, 238" : "16, 185, 129"}, ${p.alpha})`;
        ctx.fill();
      });

      if (frameCount > 288 && frameCount < 324) {
        const flashAlpha = (frameCount - 288) / 36;
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, width, height);
      }

      if (frameCount === 312 && !completeCalledRef.current) {
        completeCalledRef.current = true;
        onComplete();
      }

      if (frameCount > 312) {
        setOpacity((prev) => Math.max(0, prev - 0.05));
      }

      if (frameCount < 340) {
        animationFrameId = window.requestAnimationFrame(render);
      }
    };

    animationFrameId = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [onComplete]);

  if (opacity <= 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[70] pointer-events-none"
      style={{ opacity, transition: "opacity 0.45s ease-out" }}
    />
  );
}
