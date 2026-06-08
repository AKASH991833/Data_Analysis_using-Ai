"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  ThemeToggle: React.FC;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    document.documentElement.className = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const ThemeToggle = useCallback(
    () => (
      <button
        onClick={toggle}
        className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-all"
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    ),
    [toggle, theme]
  );

  return (
    <ThemeContext.Provider value={{ theme, toggle, ThemeToggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
