"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface DottedGlowBackgroundProps {
  className?: string;
  gap?: number;
  radius?: number;
  color?: string;
  darkColor?: string;
  glowColor?: string;
  darkGlowColor?: string;
  colorLightVar?: string;
  colorDarkVar?: string;
  glowColorLightVar?: string;
  glowColorDarkVar?: string;
  opacity?: number;
  backgroundOpacity?: number;
  speedMin?: number;
  speedMax?: number;
  speedScale?: number;
  children?: React.ReactNode;
}

export function DottedGlowBackground({
  className,
  gap = 12,
  radius = 2,
  color = "rgba(0,0,0,0.7)",
  darkColor,
  glowColor = "rgba(0, 170, 255, 0.85)",
  darkGlowColor,
  colorLightVar,
  colorDarkVar,
  glowColorLightVar,
  glowColorDarkVar,
  opacity = 0.6,
  backgroundOpacity = 0,
  speedMin = 0.4,
  speedMax = 1.3,
  speedScale = 1,
  children,
}: DottedGlowBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Listen for dark mode changes
    const observer = new MutationObserver(() => {
      // Trigger a redraw when dark mode changes
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const dots: Array<{
      x: number;
      y: number;
      radius: number;
      speed: number;
      phase: number;
      glowIntensity: number;
    }> = [];

    const cols = Math.ceil(canvas.width / gap);
    const rows = Math.ceil(canvas.height / gap);

    for (let i = 0; i < cols * rows; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      dots.push({
        x: col * gap + gap / 2,
        y: row * gap + gap / 2,
        radius: radius,
        speed: speedMin + Math.random() * (speedMax - speedMin),
        phase: Math.random() * Math.PI * 2,
        glowIntensity: Math.random(),
      });
    }

    let time = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Check if dark mode is active (check for dark class on html element)
      const isDark = document.documentElement.classList.contains("dark");
      
      // Helper function to convert HSL string to RGB
      const hslToRgb = (hslStr: string): string => {
        const parts = hslStr.trim().split(/\s+/);
        if (parts.length === 3) {
          const h = parseInt(parts[0]);
          const s = parseInt(parts[1]);
          const l = parseInt(parts[2]);
          // Convert HSL to RGB
          const sNorm = s / 100;
          const lNorm = l / 100;
          const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
          const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
          const m = lNorm - c / 2;
          let r = 0, g = 0, b = 0;
          if (h < 60) { r = c; g = x; b = 0; }
          else if (h < 120) { r = x; g = c; b = 0; }
          else if (h < 180) { r = 0; g = c; b = x; }
          else if (h < 240) { r = 0; g = x; b = c; }
          else if (h < 300) { r = x; g = 0; b = c; }
          else { r = c; g = 0; b = x; }
          return `rgb(${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)})`;
        }
        return hslStr;
      };
      
      let dotColor: string;
      if (isDark) {
        if (colorDarkVar) {
          const varValue = getComputedStyle(document.documentElement).getPropertyValue(colorDarkVar).trim();
          dotColor = varValue ? hslToRgb(varValue) : (darkColor || color);
        } else {
          dotColor = darkColor || color;
        }
      } else {
        if (colorLightVar) {
          const varValue = getComputedStyle(document.documentElement).getPropertyValue(colorLightVar).trim();
          dotColor = varValue ? hslToRgb(varValue) : color;
        } else {
          dotColor = color;
        }
      }

      let glow: string;
      if (isDark) {
        if (glowColorDarkVar) {
          const varValue = getComputedStyle(document.documentElement).getPropertyValue(glowColorDarkVar).trim();
          glow = varValue ? hslToRgb(varValue) : (darkGlowColor || glowColor);
        } else {
          glow = darkGlowColor || glowColor;
        }
      } else {
        if (glowColorLightVar) {
          const varValue = getComputedStyle(document.documentElement).getPropertyValue(glowColorLightVar).trim();
          glow = varValue ? hslToRgb(varValue) : glowColor;
        } else {
          glow = glowColor;
        }
      }

      time += 0.016 * speedScale;

      dots.forEach((dot) => {
        const alpha = 0.3 + 0.7 * (Math.sin(time * dot.speed + dot.phase) * 0.5 + 0.5);
        const currentRadius = dot.radius * (0.8 + 0.4 * alpha);

        ctx.save();
        ctx.globalAlpha = opacity * alpha;

        if (alpha > 0.7) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = glow;
        }

        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      if (backgroundOpacity > 0) {
        const gradient = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          0,
          canvas.width / 2,
          canvas.height / 2,
          Math.max(canvas.width, canvas.height) / 2
        );
        gradient.addColorStop(0, `rgba(0,0,0,${backgroundOpacity})`);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      observer.disconnect();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    gap,
    radius,
    color,
    darkColor,
    glowColor,
    darkGlowColor,
    colorLightVar,
    colorDarkVar,
    glowColorLightVar,
    glowColorDarkVar,
    opacity,
    backgroundOpacity,
    speedMin,
    speedMax,
    speedScale,
  ]);

  return (
    <div className={cn("relative w-full h-full", className)}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none" }}
      />
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}

