import { useEffect, useState } from "react";

function getInitialTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return (
    <button
      type="button"
      className="shakh-icon-button"
      aria-label={theme === "dark" ? "گۆڕین بۆ ڕووناکی" : "گۆڕین بۆ تاریکی"}
      aria-pressed={theme === "dark"}
      title={theme === "dark" ? "ڕووناکی" : "تاریکی"}
      onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
    >
      <span aria-hidden="true" className="text-sm font-black">{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
