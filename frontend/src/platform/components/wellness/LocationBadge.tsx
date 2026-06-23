import { Globe, Building2, MapPin } from "lucide-react";

type Props = {
  type: "online" | "meeting_room" | "dharma_space";
  detail?: string | null;
};

const labels = {
  online: { icon: Globe, label: "Online", className: "cwp-pill-online" },
  meeting_room: { icon: Building2, label: "Meeting Room", className: "cwp-pill-room" },
  dharma_space: { icon: MapPin, label: "Dharma Space", className: "cwp-pill-dharma" }
};

export function LocationBadge({ type, detail }: Props) {
  const cfg = labels[type] || labels.online;
  const Icon = cfg.icon;
  return (
    <span className={`cwp-pill inline-flex items-center gap-1.5 ${cfg.className}`} title={detail || undefined}>
      <Icon size={14} strokeWidth={1.75} />
      {cfg.label}
    </span>
  );
}
