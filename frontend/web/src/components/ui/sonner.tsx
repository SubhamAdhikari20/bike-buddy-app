"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () =>
      setTheme(root.classList.contains("dark") ? "dark" : "light");
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      theme={theme}
      richColors
      closeButton
      position="top-right"
      mobileOffset={{ top: 16, right: 16, left: 16 }}
      toastOptions={{
        classNames: {
          toast: "font-sans",
          title: "font-semibold",
          description: "text-sm",
        },
      }}
    />
  );
}
