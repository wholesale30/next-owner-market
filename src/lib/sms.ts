/** Free email-to-text gateways for US carriers. Message = phone digits @ gateway. */
export const CARRIERS: { key: string; label: string; gateway: string; dead?: string }[] = [
  { key: "verizon", label: "Verizon", gateway: "vtext.com" },
  { key: "xfinity", label: "Xfinity Mobile", gateway: "vtext.com" },
  { key: "visible", label: "Visible", gateway: "vtext.com" },
  { key: "straighttalk", label: "Straight Talk", gateway: "vtext.com" },
  { key: "uscellular", label: "US Cellular", gateway: "email.uscc.net" },
  { key: "boost", label: "Boost", gateway: "sms.myboostmobile.com" },
  { key: "googlefi", label: "Google Fi", gateway: "msg.fi.google.com" },
  { key: "consumer", label: "Consumer Cellular", gateway: "mailmymobile.net" },
  // These carriers shut off free email-to-text (AT&T + Cricket June 17 2025; T-Mobile, Metro, Mint ~Dec 2024; Sprint 2022).
  { key: "att", label: "AT&T", gateway: "txt.att.net", dead: "AT&T turned off free text alerts in June 2025" },
  { key: "cricket", label: "Cricket", gateway: "sms.cricketwireless.net", dead: "Cricket (AT&T) turned off free text alerts in June 2025" },
  { key: "tmobile", label: "T-Mobile", gateway: "tmomail.net", dead: "T-Mobile turned off free text alerts" },
  { key: "metro", label: "Metro by T-Mobile", gateway: "mymetropcs.com", dead: "Metro (T-Mobile) turned off free text alerts" },
  { key: "mint", label: "Mint Mobile", gateway: "tmomail.net", dead: "Mint (T-Mobile) turned off free text alerts" },
  { key: "sprint", label: "Sprint", gateway: "messaging.sprintpcs.com", dead: "Sprint no longer exists" },
];
const DEAD_GATEWAYS = new Set(["txt.att.net", "mms.att.net", "sms.cricketwireless.net", "tmomail.net", "mymetropcs.com", "messaging.sprintpcs.com"]);
export function gatewayDead(addr?: string | null) { return !!addr && DEAD_GATEWAYS.has(addr.split("@")[1] || ""); }

export function smsAddress(phone: string, carrierKey: string): string | null {
  const digits = phone.replace(/\D/g, "").replace(/^1(\d{10})$/, "$1");
  const c = CARRIERS.find((x) => x.key === carrierKey);
  if (digits.length !== 10 || !c) return null;
  return `${digits}@${c.gateway}`;
}

/** Text a seller (via their carrier gateway) if they've turned it on. Fire-and-forget. */
export async function textSeller(profile: { sms_gateway?: string | null; alert_messages?: boolean; alert_orders?: boolean }, kind: "message" | "order", body: string) {
  if (!profile.sms_gateway || !process.env.RESEND_API_KEY || gatewayDead(profile.sms_gateway)) return;
  if (kind === "message" && profile.alert_messages === false) return;
  if (kind === "order" && profile.alert_orders === false) return;
  const from = process.env.EMAIL_FROM || "Next Owner Market <alerts@nextownermarket.com>";
  try {
    await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [profile.sms_gateway], subject: "", text: body.slice(0, 150) }) });
  } catch { /* best effort */ }
}
