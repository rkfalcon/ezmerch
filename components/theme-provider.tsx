"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="fixed bottom-4 right-4 z-50 flex size-11 items-center justify-center rounded-full border-2 border-border bg-background text-foreground shadow-md transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}
      storageKey="ezmerch-theme" disableTransitionOnChange>
      {children}
      <ThemeToggle />
    </NextThemesProvider>
  );
}
