"use client";

import { useRef, useEffect } from "react";

interface ParallaxImageProps {
  children: React.ReactNode;
  className?: string;
  speed?: number;
}

export default function ParallaxImage({
  children,
  className,
  speed = 0.3,
}: ParallaxImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    const distance = 100 * speed;

    function onScroll() {
      if (!container || !inner) return;
      const rect = container.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Calculate progress: 0 when top of container enters bottom of viewport,
      // 1 when bottom of container exits top of viewport
      const progress = 1 - (rect.bottom / (windowHeight + rect.height));
      const clampedProgress = Math.max(0, Math.min(1, progress));

      // Interpolate from -distance to +distance
      const y = -distance + clampedProgress * distance * 2;
      inner.style.transform = `translateY(${y}px)`;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, [speed]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ overflow: "hidden" }}
    >
      <div
        ref={innerRef}
        style={{ willChange: "transform" }}
      >
        {children}
      </div>
    </div>
  );
}
