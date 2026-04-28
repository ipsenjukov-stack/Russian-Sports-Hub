import React, { createContext, useContext, useState } from "react";

interface LeagueContextValue {
  selectedLeagues: string[];
  setSelectedLeagues: (leagues: string[]) => void;
}

const LeagueContext = createContext<LeagueContextValue>({
  selectedLeagues: ["Российская Премьер-лига"],
  setSelectedLeagues: () => {},
});

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>(["Российская Премьер-лига"]);
  return (
    <LeagueContext.Provider value={{ selectedLeagues, setSelectedLeagues }}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  return useContext(LeagueContext);
}
