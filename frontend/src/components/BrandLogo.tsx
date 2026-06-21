import { LOGO_MARK_URL } from "../brand";

type BrandLogoProps = {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  invert?: boolean;
};

export function BrandLogo({
  className = "flex items-center gap-2",
  iconClassName = "h-11 w-11 object-contain",
  textClassName = "text-[11px] font-medium uppercase tracking-[0.2em] text-[#4A443F]",
  invert = false
}: BrandLogoProps) {
  return (
    <span className={className}>
      <img
        src={LOGO_MARK_URL}
        alt=""
        className={iconClassName}
        style={invert ? { filter: "brightness(0) invert(1)" } : undefined}
        aria-hidden
      />
      <span className={textClassName} style={{ fontFamily: "Montserrat, sans-serif" }}>
        Dharma Space
      </span>
    </span>
  );
}
