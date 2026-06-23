import { avatarDisplayText, isAvatarImageUrl } from "./user-avatar";

type Size = "sm" | "md" | "lg";

const sizeClasses: Record<Size, { wrap: string; text: string }> = {
  sm: { wrap: "h-9 w-9", text: "text-xs" },
  md: { wrap: "h-12 w-12", text: "text-sm" },
  lg: { wrap: "h-16 w-16", text: "text-xl" }
};

type Props = {
  name: string;
  avatar?: string | null;
  size?: Size;
  className?: string;
};

export function UserAvatar({ name, avatar, size = "sm", className = "" }: Props) {
  const sizes = sizeClasses[size];
  const imageUrl = isAvatarImageUrl(avatar) ? avatar : null;
  const initials = avatarDisplayText(avatar, name);

  return (
    <span
      className={`grid ${sizes.wrap} shrink-0 place-items-center overflow-hidden rounded-full bg-sage/20 font-semibold text-navy ${className}`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={sizes.text}>{initials}</span>
      )}
    </span>
  );
}
