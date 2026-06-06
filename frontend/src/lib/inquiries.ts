export type InquiryType =
  | "contact"
  | "waitlist"
  | "booking_payment"
  | "class_waitlist"
  | "class_schedule_notify"
  | "booking_intent"
  | "booking_confirmed";

export type InquirySegment =
  | "CORPORATE"
  | "FLAGSHIP"
  | "COURSE"
  | "WORKSHOP"
  | "EVENT"
  | "REGULAR_CLASS";

export interface InquiryPayload {
  type: InquiryType;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message?: string;
  notes?: string;
  guests?: string;
  siteProgramId?: string;
  siteClassId?: string;
  audienceType?: "student" | "practitioner";
  context?: {
    title?: string;
    date?: string;
    time?: string;
    location?: string;
    facilitator?: string;
    price?: string;
    bookingType?: string;
    reference?: string;
    amount?: string;
    uen?: string;
    guests?: string;
    programCategory?: string;
    segment?: InquirySegment;
    paymentStatus?: "WAITLIST" | "NOT_PAID" | "PAID";
  };
}

export async function submitInquiry(payload: InquiryPayload) {
  const res = await fetch("/api/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Could not submit form");
  return data as { id: string; emailSent: boolean; stored: boolean; message: string };
}
