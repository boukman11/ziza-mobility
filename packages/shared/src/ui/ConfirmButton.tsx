import React from "react";
import Button from "./Button";

export default function ConfirmButton({
  children,
  confirmText,
  onConfirm,
  variant = "ghost",
  disabled,
}: {
  children: React.ReactNode;
  confirmText: string;
  onConfirm: () => void | Promise<void>;
  variant?: "primary" | "ghost";
  disabled?: boolean;
}) {
  return (
    <Button
      variant={variant}
      disabled={disabled}
      onClick={async () => {
        if (disabled) return;
        if (!window.confirm(confirmText)) return;
        await onConfirm();
      }}
    >
      {children}
    </Button>
  );
}
