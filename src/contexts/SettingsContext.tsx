import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type SiteMode = "dinamico" | "normal";

interface SettingsContextType {
  mode: SiteMode;
  setMode: (m: SiteMode) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  mode: "dinamico",
  setMode: () => {},
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<SiteMode>(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("vb_mode") : null;
    return saved === "normal" ? "normal" : "dinamico";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("mode-dinamico", mode === "dinamico");
    root.classList.toggle("mode-normal", mode === "normal");
  }, [mode]);

  const setMode = (m: SiteMode) => {
    setModeState(m);
    localStorage.setItem("vb_mode", m);
  };

  return (
    <SettingsContext.Provider value={{ mode, setMode }}>
      {children}
    </SettingsContext.Provider>
  );
};
