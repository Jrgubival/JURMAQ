"use client";

import { useEffect, useRef } from "react";

export default function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    function onScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? scrollTop / docHeight : 0;
      bar!.style.transform = `scaleX(${progress})`;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={barRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "3px",
        background: "linear-gradient(90deg, #e6b422, #f0c94d, #e6b422)",
        transformOrigin: "left center",
        transform: "scaleX(0)",
        willChange: "transform",
        zIndex: 9999,
        pointerEvents: "none",
        boxShadow: "0 0 8px rgba(230, 180, 34, 0.5)",
      }}
    />
  );
}
