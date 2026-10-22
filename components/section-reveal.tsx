"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface SectionRevealProps {
  children: ReactNode;
  className?: string;
}

export function SectionReveal({ children, className }: SectionRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element || preference.matches || !("IntersectionObserver" in window))
      return;

    let animation: Animation | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        animation = element.animate(
          [
            { opacity: 0, transform: "translateY(16px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
        observer.disconnect();
      },
      { threshold: 0.12 },
    );
    observer.observe(element);
    const stopAnimation = (): void => {
      if (preference.matches) animation?.finish();
    };
    preference.addEventListener("change", stopAnimation);
    return () => {
      observer.disconnect();
      animation?.cancel();
      preference.removeEventListener("change", stopAnimation);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
