"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";

const SHOW_AFTER_MS = 180;
const EXIT_MS = 440;
const MAX_WAIT_MS = 30_000;

export function RouteLoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const lastPathRef = useRef(pathname);
  const pendingTargetRef = useRef<string | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false);
  const [phase, setPhase] = useState<"hidden" | "loading" | "exiting">("hidden");

  const clearTimers = useCallback(() => {
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    startTimerRef.current = null;
    exitTimerRef.current = null;
    maxTimerRef.current = null;
  }, []);

  const beginNavigation = useCallback((target: string | null) => {
    if (target && target === lastPathRef.current) return;
    pendingTargetRef.current = target;
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    startTimerRef.current = setTimeout(() => {
      if (target && lastPathRef.current === target) return;
      if (!pendingTargetRef.current && target !== null) return;
      visibleRef.current = true;
      setPhase("loading");
      maxTimerRef.current = setTimeout(() => {
        pendingTargetRef.current = null;
        visibleRef.current = false;
        setPhase("hidden");
      }, MAX_WAIT_MS);
    }, SHOW_AFTER_MS);
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin || next.pathname === window.location.pathname) return;
      beginNavigation(next.pathname);
    }

    function onPopState() {
      beginNavigation(null);
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, [beginNavigation, clearTimers]);

  useEffect(() => {
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    pendingTargetRef.current = null;
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    startTimerRef.current = null;
    if (!visibleRef.current) return;

    visibleRef.current = false;
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    maxTimerRef.current = null;
    setPhase("exiting");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    exitTimerRef.current = setTimeout(() => setPhase("hidden"), reduceMotion ? 0 : EXIT_MS);
  }, [pathname]);

  return (
    <>
      {children}
      {phase !== "hidden" && <BrandLoader phase={phase} />}
    </>
  );
}
