import { Check } from "lucide-react";
import { CwpCard } from "../CwpCard";
import { LocationBadge } from "./LocationBadge";
import { SpotCounter } from "./SpotCounter";
import { WellnessIcon } from "./wellness-icons";
import type { WellnessEvent } from "../../../types/wellness";

type Props = {
  event: WellnessEvent;
  isBooked?: boolean;
  onJoin?: () => void;
  joinLoading?: boolean;
  showAttendees?: boolean;
};

export function EventCard({ event, isBooked, onJoin, joinLoading, showAttendees }: Props) {
  const full = event.spotsLeft <= 0;
  const date = new Date(event.dateTime);
  return (
    <article className="rounded-5xl glass flex flex-col gap-3 p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="cwp-pill cwp-pill-online inline-flex items-center gap-1.5">
            <WellnessIcon symbol={event.category.icon} name={event.category.name} size={14} />
            {event.category.name}
          </span>
          <h3 className="mt-2 font-semibold text-navy">{event.title}</h3>
        </div>
        <LocationBadge type={event.locationType} detail={event.locationDetail} />
      </div>
      <p className="text-sm text-stone">
        {date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        {" · "}
        {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        {event.trainer ? ` · ${event.trainer.name}` : ""}
      </p>
      <SpotCounter spots={event.bookedCount} max={event.maxSpots} />
      {showAttendees && event.bookedCount > 0 && (
        <p className="text-xs text-stone">{event.bookedCount} signed up</p>
      )}
      {onJoin && (
        <button
          type="button"
          className="cwp-btn-primary inline-flex items-center gap-2 self-start"
          disabled={full || isBooked || joinLoading}
          onClick={onJoin}
        >
          {isBooked && <Check size={14} strokeWidth={2} />}
          {isBooked ? "Booked" : full ? "Full" : joinLoading ? "Booking…" : "Join"}
        </button>
      )}
    </article>
  );
}
