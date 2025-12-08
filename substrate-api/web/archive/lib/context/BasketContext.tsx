"use client";
import { createContext, useContext, useState } from "react";

interface BasketCtx {
  currentBasketId: string | null;
  setCurrentBasketId: (id: string | null) => void;
}

const BasketContext = createContext<BasketCtx>({
  currentBasketId: null,
  setCurrentBasketId: () => {},
});

export function BasketProvider({ children, initialBasketId }: { children: React.ReactNode; initialBasketId?: string | null }) {
  const [currentBasketId, setCurrentBasketId] = useState<string | null>(initialBasketId ?? null);
  return (
    <BasketContext.Provider value={{ currentBasketId, setCurrentBasketId }}>
      {children}
    </BasketContext.Provider>
  );
}

export function useBasket() {
  return useContext(BasketContext);
}
