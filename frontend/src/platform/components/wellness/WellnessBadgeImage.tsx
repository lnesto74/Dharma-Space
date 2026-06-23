type Props = {
  src: string;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32"
};

export function WellnessBadgeImage({ src, alt, size = "md", className = "" }: Props) {
  return (
    <img
      src={src}
      alt={alt}
      className={`cwp-badge-image mx-auto block object-contain ${sizeClass[size]} ${className}`}
      loading="lazy"
    />
  );
}
