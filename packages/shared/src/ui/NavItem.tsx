import React from "react";
import { NavLink } from "react-router-dom";

export default function NavItem({
  to,
  end,
  children,
}: {
  to: string;
  end?: boolean;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }: { isActive: boolean }) => ({
        textDecoration: "none",
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid " + (isActive ? "#111" : "transparent"),
        background: isActive ? "#111" : "transparent",
        color: isActive ? "#fff" : "#111",
        fontWeight: 700,
      })}
    >
      {children}
    </NavLink>
  );
}
