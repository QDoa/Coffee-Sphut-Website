"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const emptySubscribe = () => () => {};

function getThemeSnapshot(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): "light" | "dark" {
  return "light";
}

function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export function ThemeToggle({ className }: { className?: string }) {
  const isMounted = useIsMounted();
  const theme = useSyncExternalStore(emptySubscribe, getThemeSnapshot, getServerSnapshot);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    const nextTheme = isDark ? "light" : "dark";

    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    try {
      localStorage.setItem("theme", nextTheme);
    } catch {
      // Ignore local storage errors in private browsing
    }
  };

  if (!isMounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={className}
        aria-label="Toggle theme"
        disabled
      >
        <span className="size-5" />
      </Button>
    );
  }

  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={className}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      type="button"
    >
      {isDark ? (
        <Sun className="size-5 text-amber-400 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon className="size-5 text-muted-foreground transition-transform duration-300 hover:-rotate-12" />
      )}
    </Button>
  );
}
