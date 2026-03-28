import React, { createContext, useContext, useMemo, useState } from "react";
import Badge from "./Badge";

export type ToastKind = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  message: string;
  kind: ToastKind;
  createdAt: number;
};

type ToastApi = {
  push: (message: string, kind?: ToastKind) => void;
};

const Ctx = createContext<ToastApi | null>(null);

function nowId() {
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const api: ToastApi = useMemo(
    () => ({
      push: (message: string, kind: ToastKind = "info") => {
        const id = nowId();
        const it: ToastItem = { id, message, kind, createdAt: Date.now() };
        setItems((prev) => [it, ...prev].slice(0, 6));
        window.setTimeout(() => {
          setItems((prev) => prev.filter((x) => x.id !== id));
        }, 3500);
      },
    }),
    []
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 9999,
          maxWidth: 420,
        }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            style={{
              border: "1px solid var(--border)",
              background: "var(--card)",
              boxShadow: "var(--shadow)",
              borderRadius: "var(--radius)",
              padding: "10px 12px",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <Badge>{t.kind}</Badge>
            <div style={{ fontWeight: 800, lineHeight: 1.3 }}>{t.message}</div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) {
    return {
      push: (_m: string, _k: ToastKind = "info") => {},
    } as ToastApi;
  }
  return v;
}
