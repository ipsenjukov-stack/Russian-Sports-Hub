import React, { createContext, useContext, useState } from "react";
import { SettingsModal } from "@/components/SettingsModal";

interface SettingsContextType {
  openSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType>({ openSettings: () => {} });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <SettingsContext.Provider value={{ openSettings: () => setOpen(true) }}>
      {children}
      <SettingsModal visible={open} onClose={() => setOpen(false)} />
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
