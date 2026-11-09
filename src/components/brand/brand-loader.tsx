"use client";

import { useEffect, useRef } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";

type BrandLoaderProps = {
  phase: "loading" | "exiting";
  label?: string;
};

export function BrandLoader({ phase, label = "Загружаем раздел" }: BrandLoaderProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const screwRef = useRef<HTMLSpanElement>(null);
  const screwAnimationRef = useRef<Animation | null>(null);
  const overlayAnimationRef = useRef<Animation | null>(null);

  useEffect(() => () => {
    screwAnimationRef.current?.cancel();
    overlayAnimationRef.current?.cancel();
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    const screw = screwRef.current;
    if (!overlay || !screw) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (phase === "loading") {
      if (reduceMotion) return;
      screwAnimationRef.current = screw.animate(
        [
          { transform: "translateX(0) rotate(0deg)", offset: 0 },
          { transform: "translateX(22%) rotate(-360deg)", offset: 0.62 },
          { transform: "translateX(22%) rotate(-360deg)", offset: 0.76 },
          { transform: "translateX(0) rotate(-360deg)", offset: 1 },
        ],
        { duration: 2300, iterations: Infinity, easing: "cubic-bezier(.55,.04,.42,.96)" },
      );
      return;
    }

    if (reduceMotion) {
      overlay.style.opacity = "0";
      return;
    }

    const currentTransform = getComputedStyle(screw).transform;
    const currentOpacity = getComputedStyle(overlay).opacity;
    screwAnimationRef.current?.cancel();
    overlayAnimationRef.current?.cancel();
    screwAnimationRef.current = screw.animate(
      [{ transform: currentTransform === "none" ? "translateX(0) rotate(0deg)" : currentTransform }, { transform: "translateX(0) rotate(0deg)" }],
      { duration: 380, easing: "cubic-bezier(.2,.75,.25,1)", fill: "forwards" },
    );
    overlayAnimationRef.current = overlay.animate(
      [{ opacity: currentOpacity }, { opacity: 0 }],
      { duration: 420, easing: "ease-in", fill: "forwards" },
    );
  }, [phase]);

  return (
    <div ref={overlayRef} className="brand-loader" data-phase={phase} role="status" aria-live="polite" aria-label={label}>
      <div className="brand-loader__content">
        <BrandLogo
          variant="dark"
          className="brand-loader__logo"
          sizes="(max-width: 640px) 82vw, 420px"
          animatedScrew
          screwRef={screwRef}
        />
        <p className="brand-loader__label">{label}</p>
      </div>
    </div>
  );
}
