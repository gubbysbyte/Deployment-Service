"use client";

import { useEffect, useRef } from "react";

// A soft radial glow that trails the pointer behind the page content.
// Purely decorative (purpose: delight, gated to a first-visit marketing
// page), so it opts out entirely on touch devices and reduced motion
// instead of degrading gracefully - there's nothing essential to keep.
export default function AmbientGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canHover || reduceMotion) return;

    function handleMove(e: PointerEvent) {
      // Direct style mutation on this leaf node only - no React state, no
      // CSS variable set on a shared ancestor, so nothing else re-renders
      // or recalculates style because of this.
      el!.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      el!.style.opacity = "1";
    }
    function handleLeave() {
      el!.style.opacity = "0";
    }

    window.addEventListener("pointermove", handleMove);
    document.documentElement.addEventListener("pointerleave", handleLeave);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      document.documentElement.removeEventListener("pointerleave", handleLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-0 h-140 w-140 rounded-full opacity-0 blur-3xl transition-opacity duration-500 ease-out will-change-transform"
      style={{
        background: "radial-gradient(circle, rgba(16,185,129,0.14), transparent 70%)",
        transition: "opacity 500ms var(--ease-out), transform 200ms var(--ease-out)",
      }}
    />
  );
}
