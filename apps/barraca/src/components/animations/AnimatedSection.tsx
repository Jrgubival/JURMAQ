"use client";

import { useEffect, useRef } from "react";

type AnimationType =
  | "fadeUp"
  | "fadeIn"
  | "slideLeft"
  | "slideRight"
  | "scaleIn";

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  animation?: AnimationType;
  delay?: number;
  duration?: number;
}

const animationClassMap: Record<AnimationType, string> = {
  fadeUp: "animate-on-scroll",
  fadeIn: "animate-fade-in",
  slideLeft: "animate-slide-left",
  slideRight: "animate-slide-right",
  scaleIn: "animate-scale-in",
};

export default function AnimatedSection({
  children,
  className,
  animation = "fadeUp",
  delay = 0,
  duration = 0.8,
}: AnimatedSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    // Apply custom duration and delay via inline style
    el.style.transitionDuration = `${duration}s`;
    if (delay > 0) {
      el.style.transitionDelay = `${delay}s`;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("animated");
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [delay, duration]);

  const animClass = animationClassMap[animation];

  return (
    <div
      ref={sectionRef}
      className={`${animClass}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
