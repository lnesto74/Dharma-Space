import { OAuth2Client } from "google-auth-library";

const CORPORATE_ROLES = new Set(["EMPLOYEE", "HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"]);

export function isCorporateRole(role: string) {
  return CORPORATE_ROLES.has(role);
}

export async function verifyGoogleIdToken(idToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured in backend/.env");
  }
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload?.email) throw new Error("Google account has no email");
  return {
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split("@")[0],
    picture: payload.picture || null,
    emailVerified: payload.email_verified === true
  };
}

export function corporateDomainAllowed(email: string) {
  const allowed = (process.env.CORPORATE_ALLOWED_DOMAINS || "dharma-space.com")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return allowed.some((d) => domain === d || domain.endsWith(`.${d}`));
}
