"use client";

import { useRef, useEffect } from "react";

interface StaggeredGridProps {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  duration?: number;
}

export default function StaggeredGrid({
  children,
  className,
  stagger = 0.12,
  duration = 0.6,
}: StaggeredGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = gridRef.current;
    if (!el || animated.current) return;

    const items = el.querySelectorAll<HTMLElement>(":scope > *");
    if (items.length === 0) return;

    // Hide items initially
    items.forEach((item) => {
      item.style.opacity = "0";
      item.style.transform = "translateY(30px)";
      item.style.transition = `opacity ${duration}s ease, transform ${duration}s ease`;
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animated.current = true;

          items.forEach((item, i) => {
            item.style.transitionDelay = `${i * stagger}s`;
            // Trigger in next frame so the browser registers the initial state
            requestAnimationFrame(() => {
              item.style.opacity = "1";
              item.style.transform = "none";
            });
          });

          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [stagger, duration]);

  return (
    <div ref={gridRef} className={className}>
      {children}
    </div>
  );
}
