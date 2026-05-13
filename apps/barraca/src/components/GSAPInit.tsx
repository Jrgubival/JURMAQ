"use client";

/**
 * GSAPInit — inicializa animaciones GSAP/ScrollTrigger globales.
 *
 * Mounted via dynamic() en src/app/(public)/layout.tsx con ssr:false.
 * Sólo se carga en marketing site (/, /maquinarias, /contacto, etc.) —
 * admin y barraca no pagan los ~230KB de GSAP.
 *
 * AST no captura dynamic imports → componente aparece satélite.
 */

import { useEffect } from "react";

declare global {
  interface Window {
    gsap: any;
    ScrollTrigger: any;
  }
}

export default function GSAPInit() {
  useEffect(() => {
    // Wait for GSAP to load from CDN
    const checkGSAP = setInterval(() => {
      if (window.gsap && window.ScrollTrigger) {
        clearInterval(checkGSAP);
        window.gsap.registerPlugin(window.ScrollTrigger);
        initAnimations();
      }
    }, 100);

    return () => clearInterval(checkGSAP);
  }, []);

  return null;
}

function initAnimations() {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  // Animate all elements with data-animate attribute
  document.querySelectorAll("[data-animate]").forEach((el) => {
    const type = el.getAttribute("data-animate") || "fadeUp";
    const delay = parseFloat(el.getAttribute("data-delay") || "0");
    const duration = parseFloat(el.getAttribute("data-duration") || "0.8");

    let fromVars: any = { opacity: 0, y: 40 };
    if (type === "fadeIn") fromVars = { opacity: 0 };
    if (type === "slideLeft") fromVars = { opacity: 0, x: 60 };
    if (type === "slideRight") fromVars = { opacity: 0, x: -60 };
    if (type === "scaleIn") fromVars = { opacity: 0, scale: 0.9 };

    ScrollTrigger.create({
      trigger: el,
      start: "top 90%",
      once: true,
      onEnter: () => {
        gsap.from(el, { ...fromVars, duration, delay, ease: "power2.out" });
      },
    });
  });

  // Stagger grids
  document.querySelectorAll("[data-stagger]").forEach((grid) => {
    const stagger = parseFloat(grid.getAttribute("data-stagger") || "0.1");
    const items = grid.querySelectorAll(":scope > *");

    ScrollTrigger.create({
      trigger: grid,
      start: "top 90%",
      once: true,
      onEnter: () => {
        gsap.from(items, {
          opacity: 0,
          y: 30,
          duration: 0.7,
          stagger,
          ease: "power2.out",
        });
      },
    });
  });

  // Counter animations (smooth with easing)
  document.querySelectorAll("[data-counter]").forEach((el) => {
    const end = parseInt(el.getAttribute("data-counter") || "0");
    const prefix = el.getAttribute("data-prefix") || "";
    const suffix = el.getAttribute("data-suffix") || "";

    ScrollTrigger.create({
      trigger: el,
      start: "top 90%",
      once: true,
      onEnter: () => {
        const obj = { val: 0 };
        gsap.to(obj, {
          val: end,
          duration: 2.5,
          ease: "power3.out",
          onUpdate: () => {
            (el as HTMLElement).textContent = `${prefix}${Math.round(
              obj.val
            ).toLocaleString("es-CL")}${suffix}`;
          },
        });
      },
    });
  });

  // Parallax sections
  document.querySelectorAll("[data-parallax]").forEach((el) => {
    const speed = parseFloat(el.getAttribute("data-parallax") || "0.3");
    gsap.to(el, {
      y: () => speed * 100,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    });
  });

  // Smooth scroll progress bar
  const progressBar = document.querySelector("[data-scroll-progress]");
  if (progressBar) {
    gsap.to(progressBar, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        trigger: document.documentElement,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.3,
      },
    });
  }

  // ===== PREMIUM ANIMATIONS =====

  // Text reveal animation (data-text-reveal)
  // Words animate in from below with stagger
  document.querySelectorAll("[data-text-reveal]").forEach((el) => {
    const text = el.textContent || "";
    const words = text.split(" ");
    el.innerHTML = words
      .map(
        (w) =>
          `<span style="display:inline-block;overflow:hidden;vertical-align:top"><span style="display:inline-block;transform:translateY(100%)">${w}</span></span>`
      )
      .join(" ");

    ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      once: true,
      onEnter: () => {
        gsap.to(el.querySelectorAll("span > span"), {
          y: 0,
          duration: 0.8,
          stagger: 0.05,
          ease: "power3.out",
        });
      },
    });
  });

  // Horizontal scroll section (data-scroll-x)
  // Content scrolls horizontally as user scrolls vertically
  document.querySelectorAll("[data-scroll-x]").forEach((el) => {
    const inner = el.querySelector("[data-scroll-x-inner]");
    if (!inner) return;
    gsap.to(inner, {
      x: () => -(inner.scrollWidth - (el as HTMLElement).clientWidth),
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "top center",
        end: () => "+=" + (inner.scrollWidth - (el as HTMLElement).clientWidth),
        scrub: 1,
        pin: false,
      },
    });
  });

  // Magnetic hover (data-magnetic)
  // Subtle magnetic effect where elements follow the cursor slightly
  // Only on devices with fine pointer (not touch)
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  if (!isTouch) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      el.addEventListener("mousemove", (e: Event) => {
        const me = e as MouseEvent;
        const rect = (el as HTMLElement).getBoundingClientRect();
        const x = (me.clientX - rect.left - rect.width / 2) * 0.3;
        const y = (me.clientY - rect.top - rect.height / 2) * 0.3;
        gsap.to(el, { x, y, duration: 0.3, ease: "power2.out" });
      });
      el.addEventListener("mouseleave", () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" });
      });
    });
  }
}
