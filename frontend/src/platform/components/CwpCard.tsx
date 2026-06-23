import { ReactNode } from "react";

export function CwpCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-5xl glass p-6 ${className}`}>{children}</div>;
}
