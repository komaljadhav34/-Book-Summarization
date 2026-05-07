import { createContext, useContext, useState } from "react";

const Ctx = createContext(null);

export function SummaryOptionsProvider({ children }) {
  const [format, setFormat] = useState("CONCISE");
  const [role,   setRole]   = useState("GENERAL");
  return (
    <Ctx.Provider value={{ format, setFormat, role, setRole }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSummaryOptions() {
  return useContext(Ctx);
}