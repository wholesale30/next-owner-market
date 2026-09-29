import type { Profile } from "@/lib/types";

export const isStaff = (p: Pick<Profile, "role">) => p.role === "admin" || p.role === "staff";
export const isPro = (p: Pick<Profile, "role" | "plan">) => isStaff(p) || p.plan === "pro";
/** Can this user use a Pro-only tool right now? Staff always; Pro always; free users only while they have AI credits (for AI tools). */
export const canUseAi = (p: Pick<Profile, "role" | "plan" | "ai_credits">) => isPro(p) || (p.ai_credits ?? 0) > 0;
