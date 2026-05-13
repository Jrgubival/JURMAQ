"use client";

import { useRef, useEffect } from "react";

interface AnimatedTextProps {
  children: string;
  element?: "h1" | "h2" | "h3" | "p";
  className?: string;
  splitBy?: "chars" | "words";
  staggerAmount?: number;
  duration?: number;
}

export default function AnimatedText({
  children,
  element: Tag = "h2",
  className,
  splitBy = "words",
  staggerAmount = 0.03,
  duration = 0.6,
}: AnimatedTextProps) {
  const containerRef = useRef<HTMLElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || animated.current) return;

    const spans = el.querySelectorAll<HTMLSpanElement>(".anim-unit");
    if (spans.length === 0) return;

    // Set initial hidden state
    spans.forEach((span) => {
      span.style.opacity = "0";
      span.style.transform = "translateY(20px)";
      span.style.transition = `opacity ${duration}s ease, transform ${duration}s ease`;
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animated.current = true;

          spans.forEach((span, i) => {
            span.style.transitionDelay = `${i * staggerAmount}s`;
            requestAnimationFrame(() => {
              span.style.opacity = "1";
              span.style.transform = "none";
            });
          });

          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [staggerAmount, duration]);

  // Split text into spans
  const units =
    splitBy === "chars"
      ? children.split("").map((char, i) => (
          <span
            key={i}
            className="anim-unit inline-block"
            style={{ willChange: "transform, opacity" }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))
      : children.split(" ").map((word, i, arr) => (
          <span
            key={i}
            className="anim-unit inline-block"
            style={{ willChange: "transform, opacity" }}
          >
            {word}
            {i < arr.length - 1 ? "\u00A0" : ""}
          </span>
        ));

  return (
    <Tag
      ref={containerRef as React.RefObject<HTMLHeadingElement & HTMLParagraphElement>}
      className={className}
    >
      {units}
    </Tag>
  );
}
