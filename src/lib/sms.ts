/** Free email-to-text gateways for US carriers. Message = phone digits @ gateway. */
export const CARRIERS: { key: string; label: string; gateway: string }[] = [
  { key: "verizon", label: "Verizon", gateway: "vtext.com" },
  { key: "att", label: "AT&T", gateway: "txt.att.net" },
  { key: "tmobile", label: "T-Mobile", gateway: "tmomail.net" },
  { key: "sprint", label: "Sprint", gateway: "messaging.sprintpcs.com" },
  { key: "uscellular", label: "US Cellular", gateway: "email.uscc.net" },
  { key: "cricket", label: "Cricket", gateway: "sms.cricketwireless.net" },
  { key: "boost", label: "Boost", gateway: "sms.myboostmobile.com" },
  { key: "metro", label: "Metro by T-Mobile", gateway: "mymetropcs.com" },
  { key: "xfinity", label: "Xfinity Mobile", gateway: "vtext.com" },
  { key: "visible", label: "Visible", gateway: "vtext.com" },
  { key: "mint", label: "Mint Mobile", gateway: "tmomail.net" },
  { key: "googlefi", label: "Google Fi", gateway: "msg.fi.google.com" },
  { key: "straighttalk", label: "Straight Talk", gateway: "vtext.com" },
  { key: "consumer", label: "Consumer Cellular", gateway: "mailmymobile.net" },
];

export function smsAddress(phone: string, carrierKey: string): string | null {
  const digits = phone.replace(/\D/g, "").replace(/^1(\d{10})$/, "$1");
  const c = CARRIERS.find((x) => x.key === carrierKey);
  if (digits.length !== 10 || !c) return null;
  return `${digits}@${c.gateway}`;
}

/** Text a seller (via their carrier gateway) if they've turned it on. Fire-and-forget. */
export async function textSeller(profile: { sms_gateway?: string | null; alert_messages?: boolean; alert_orders?: boolean }, kind: "message" | "order", body: string) {
  if (!profile.sms_gateway || !process.env.RESEND_API_KEY) return;
  if (kind === "message" && profile.alert_messages === false) return;
  if (kind === "order" && profile.alert_orders === false) return;
  const from = process.env.EMAIL_FROM || "Next Owner Market <alerts@nextownermarket.com>";
  try {
    await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [profile.sms_gateway], subject: "", text: body.slice(0, 150) }) });
  } catch { /* best effort */ }
}
