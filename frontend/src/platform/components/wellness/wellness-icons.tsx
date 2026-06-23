import type { LucideIcon } from "lucide-react";
import {
  Award,
  BarChart3,
  Bird,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  Coffee,
  Flame,
  Footprints,
  Globe,
  Handshake,
  Leaf,
  Lock,
  MapPin,
  Mic,
  Moon,
  Music,
  Smartphone,
  Sprout,
  Target,
  TrendingUp,
  Trophy,
  Waves,
  Wind,
  XCircle,
  type LucideProps
} from "lucide-react";
import { MedalRank } from "./MedalRank";

const SYMBOL_MAP: Record<string, LucideIcon> = {
  "🎤": Mic,
  "📚": BookOpen,
  "🌿": Leaf,
  "🎯": Target,
  "🧘": Sprout,
  "🌬️": Wind,
  "🕯️": Moon,
  "🤸": Target,
  "🎵": Music,
  "🤝": Handshake,
  "🌐": Globe,
  "🏢": Building2,
  "🏅": Award,
  "👣": Footprints,
  "🦥": Moon,
  "🐼": Sprout,
  "🦦": Waves,
  "🐺": Target,
  "🦅": Bird,
  "🐉": Flame,
  "💧": Waves,
  "📊": BarChart3,
  "📱": Smartphone,
  "☕": Coffee,
  "🫁": Wind,
  "🐦": Bird,
  "🔒": Lock
};

const NAME_MAP: Record<string, LucideIcon> = {
  "Breathwork Survivor": Wind,
  "Chair Yoga Warrior": Sprout,
  "Hydration Deity": Waves,
  "Silent Savasana Champion": Moon,
  "Spreadsheet Monk": BarChart3,
  "Slack Notification Yogi": Smartphone,
  "Caffeine Recovery Specialist": Coffee,
  "CEO of Deep Breathing": Wind,
  "Sound Healer Initiate": Music,
  "Team Player": Handshake,
  "Early Bird": Bird,
  "Corporate Dragon Tamer": Flame,
  "Slumbering Sloth": Moon,
  "Zen Sloth": Moon,
  "Peaceful Panda": Sprout,
  "Calm Panda": Sprout,
  "Zen Otter": Waves,
  "Balanced Otter": Waves,
  "Focused Wolf": Target,
  "Mindful Wolf": Target,
  "Soaring Eagle": Bird,
  "Elevated Eagle": Bird,
  "Corporate Dragon": Flame,
  online: Globe,
  meeting_room: Building2,
  dharma_space: MapPin
};

export function resolveWellnessIcon(symbol?: string | null, name?: string): LucideIcon {
  if (symbol && SYMBOL_MAP[symbol]) return SYMBOL_MAP[symbol];
  if (name && NAME_MAP[name]) return NAME_MAP[name];
  return Leaf;
}

type IconProps = {
  symbol?: string | null;
  name?: string;
  className?: string;
  size?: number;
} & Pick<LucideProps, "strokeWidth">;

export function WellnessIcon({ symbol, name, className, size = 18, strokeWidth = 1.75 }: IconProps) {
  const Icon = resolveWellnessIcon(symbol, name);
  return <Icon size={size} strokeWidth={strokeWidth} className={className} />;
}

export function RankIcon({ rank, className }: { rank: number; className?: string }) {
  if (rank <= 3) return <MedalRank rank={rank} size="sm" className={className} />;
  return <span className={`text-sm font-semibold tabular-nums ${className || ""}`}>{rank}</span>;
}

export function TrophyIcon({ className }: { className?: string }) {
  return <Trophy size={18} strokeWidth={1.75} className={className} />;
}

export { Check, CheckCircle2, XCircle, TrendingUp, Lock };
