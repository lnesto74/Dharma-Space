import { useRef, useState } from "react";
import { Camera, Loader2, Pencil } from "lucide-react";
import { avatarDisplayText, isAvatarImageUrl } from "./user-avatar";

const API_URL = import.meta.env.VITE_API_URL || "";

type Size = "md" | "lg";

const sizeClasses: Record<Size, { wrap: string; text: string; button: string; icon: number }> = {
  md: { wrap: "h-16 w-16", text: "text-xl", button: "h-7 w-7", icon: 13 },
  lg: { wrap: "h-24 w-24", text: "text-3xl", button: "h-8 w-8", icon: 14 }
};

type Props = {
  name: string;
  avatar?: string | null;
  size?: Size;
  editable?: boolean;
  token?: string;
  onAvatarChange?: (avatarUrl: string) => void;
  className?: string;
};

export function ProfileAvatar({
  name,
  avatar,
  size = "lg",
  editable = false,
  token,
  onAvatarChange,
  className = ""
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  const displayUrl = preview || (isAvatarImageUrl(avatar) ? avatar : null);
  const initials = avatarDisplayText(avatar, name);
  const sizes = sizeClasses[size];

  const handleFile = async (file: File | null | undefined) => {
    if (!file || !editable) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Image must be under 4 MB.");
      return;
    }

    setError("");
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    if (!token) {
      onAvatarChange?.(objectUrl);
      return;
    }

    setUploading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || "");
        };
        reader.onerror = () => reject(new Error("Could not read image"));
        reader.readAsDataURL(file);
      });

      const response = await fetch(`${API_URL}/api/auth/avatar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ data, filename: file.name })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Upload failed");

      URL.revokeObjectURL(objectUrl);
      setPreview(null);
      onAvatarChange?.(payload.url);
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={`relative inline-grid place-items-center ${className}`}>
      <div
        className={`grid ${sizes.wrap} place-items-center overflow-hidden rounded-full navy-gradient font-semibold text-white`}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className={sizes.text}>{initials}</span>
        )}
        {uploading && (
          <div className="absolute inset-0 grid place-items-center rounded-full bg-black/40">
            <Loader2 className="animate-spin text-white" size={sizes.icon + 6} />
          </div>
        )}
      </div>

      {editable && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <button
            type="button"
            aria-label={displayUrl ? "Edit profile photo" : "Add profile photo"}
            title={displayUrl ? "Edit photo" : "Add photo"}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className={`absolute -bottom-0.5 -right-0.5 grid ${sizes.button} place-items-center rounded-full border-2 border-white bg-[var(--cwp-surface)] text-[var(--cwp-charcoal)] shadow-md transition hover:bg-[var(--cwp-bg)] disabled:opacity-60`}
          >
            {displayUrl ? <Pencil size={sizes.icon} strokeWidth={2} /> : <Camera size={sizes.icon} strokeWidth={2} />}
          </button>
        </>
      )}

      {error && <p className="absolute -bottom-6 left-1/2 w-max max-w-[12rem] -translate-x-1/2 text-center text-xs text-[var(--cwp-error)]">{error}</p>}
    </div>
  );
}
