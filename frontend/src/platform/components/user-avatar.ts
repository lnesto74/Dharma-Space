export function isAvatarImageUrl(avatar?: string | null): boolean {
  if (!avatar) return false;
  return (
    avatar.startsWith("/api/")
    || avatar.startsWith("http://")
    || avatar.startsWith("https://")
    || avatar.startsWith("data:image/")
  );
}

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function avatarDisplayText(avatar: string | null | undefined, name: string): string {
  if (!avatar || isAvatarImageUrl(avatar)) return initialsFromName(name);
  return avatar;
}
