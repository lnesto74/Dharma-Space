import { X } from "lucide-react";

export const PANEL = "bg-[#FAF8F3] w-full sm:max-w-lg max-h-[95vh] overflow-y-auto";
export const BODY = { fontFamily: "var(--font-body)" } as const;
export const DISPLAY = { fontFamily: "var(--font-display)" } as const;

/** The standard purchase-modal frame: eyebrow, title, close, and a body. */
export function ModalShell({
  eyebrow,
  title,
  onClose,
  wide,
  children
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#1A1815]/70 backdrop-blur-sm p-0 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={wide ? `${PANEL} sm:max-w-2xl` : PANEL}>
        <div className="flex items-start justify-between p-8 border-b border-[#2A2825]/8">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-1" style={BODY}>
              {eyebrow}
            </p>
            <h2 className="text-2xl font-normal text-[#2A2825]" style={DISPLAY}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#2A2825]/40 hover:text-[#2A2825] transition-colors p-1 mt-1"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
