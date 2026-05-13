"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface AnimatedCounterProps {
  end: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}

export default function AnimatedCounter({
  end,
  suffix = "",
  prefix = "",
  duration = 2.5,
  className,
}: AnimatedCounterProps) {
  const counterRef = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // IntersectionObserver to detect visibility
  useEffect(() => {
    const el = counterRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  // requestAnimationFrame counter
  const animate = useCallback(() => {
    const durationMs = duration * 1000;
    let startTime: number | null = null;

    function step(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // Ease out quad
      const easedProgress = 1 - (1 - progress) * (1 - progress);
      const currentValue = Math.round(easedProgress * end);

      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }, [end, duration]);

  useEffect(() => {
    if (isVisible) {
      animate();
    }
  }, [isVisible, animate]);

  return (
    <span
      ref={counterRef}
      className={className}
      style={{
        display: "inline-block",
      }}
    >
      {prefix}{displayValue.toLocaleString("es-CL")}{suffix}
    </span>
  );
}
