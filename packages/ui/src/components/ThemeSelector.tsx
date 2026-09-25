import React, { useEffect, useState } from "react";
import { Palette } from "lucide-react";

const THEMES = [
  "dark",
  "night",
  "dracula",
  "luxury",
  "corporate",
  "light",
  "cupcake",
  "dim",
  "nord",
] as const;

export const ThemeSelector: React.FC = () => {
  const [theme, setTheme] = useState<string>("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("airch_ui_theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem("airch_ui_theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-sm gap-1.5 font-normal capitalize"
        title="Change UI Theme"
      >
        <Palette size={15} />
        <span className="hidden sm:inline text-xs">{theme}</span>
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content menu menu-sm bg-base-200 rounded-box z-50 w-44 p-2 shadow-xl border border-base-300 max-h-80 overflow-y-auto"
      >
        <li className="menu-title text-xs font-semibold px-2 py-1 text-base-content/60">
          DaisyUI Themes
        </li>
        {THEMES.map((t) => (
          <li key={t}>
            <button
              onClick={() => changeTheme(t)}
              className={`flex items-center justify-between text-xs capitalize ${
                theme === t ? "active font-bold" : ""
              }`}
            >
              <span>{t}</span>
              {theme === t && <span className="badge badge-xs badge-primary">Current</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
