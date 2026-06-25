import type { User } from "@prisma/client";

export const ROLE_HOME: Record<string, string> = {
  EMPLOYEE: "/app/dashboard",
  HR_ADMIN: "/hr/dashboard",
  TRAINER: "/trainer/dashboard",
  CORPORATE_ADMIN: "/company/dashboard",
  SUPER_ADMIN: "/admin"
};

export const ONBOARDING_ROLES = ["EMPLOYEE", "HR_ADMIN", "CORPORATE_ADMIN", "TRAINER"] as const;

export type UserWithRelations = User & {
  company?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
};

export function pendingAccountMessage() {
  return "Your profile was submitted. A Dharma Space administrator will review your access request and notify you when you can sign in.";
}

export function sanitizeUser(user: UserWithRelations) {
  const { passwordHash: _pw, ...safe } = user;
  return {
    ...safe,
    homePath: ROLE_HOME[user.role] || "/app/dashboard",
    needsOnboarding: user.onboardingCompleted === false,
    pendingApproval: user.accountStatus === "PENDING" && user.onboardingCompleted === true
  };
}

export function canAccessPlatform(user: User) {
  return (user.accountStatus === "APPROVED" || !user.accountStatus) && user.onboardingCompleted !== false;
}

export const USER_PROFILE_INCLUDE = {
  company: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } }
} as const;
