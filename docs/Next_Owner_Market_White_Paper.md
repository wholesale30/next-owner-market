# Next Owner Market — Complete Build Record & Recovery Guide

*Prepared September 29, 2026; updated the same evening with messaging, subscriber list, instant sign-up, and gallery upload. Keep this with the source-code zip in the OneDrive folder. Together they are everything needed to rebuild the whole system from nothing.*

---

## 1. What this is

Next Owner Market (nextownermarket.com) is a phone-first web app for a surplus resale business: inventory, AI-written listings, consignment, a public storefront, auctions, pickups, buyer alerts, and clean books. Built in one day, September 29, 2026, in a conversation with Claude. Owner: Shayne Snavely (shayne.snavely@gmail.com), GitHub `wholesale30`.

Business context that shaped it: 30 years in surplus, restarting after 4–5 years out. 25,000 sq ft warehouse ($1,000/mo) with 300+ Gaylord boxes of paid-for inventory (audio gear, tools, kitchen, electronics, lamps, vintage, and more). Goals: sell fast, sell other people's goods on consignment at a strong commission, grow into a national marketplace, and keep clean records for taxes.

## 2. Live addresses

| What | Address |
|---|---|
| Store (public) | https://nextownermarket.com (also next-owner-market.vercel.app) |
| Staff / consignor sign-in | https://nextownermarket.com/login |
| Consignor sign-up | https://nextownermarket.com/signup |
| Buyer sign-up | https://nextownermarket.com/signup?buyer=1 |
| Source code | https://github.com/wholesale30/next-owner-market (private) |

## 3. The accounts (all free tier)

| Service | Purpose | Where | Identifier |
|---|---|---|---|
| GoDaddy | Domain nextownermarket.com (1 yr, $12.99, no protection) | godaddy.com | DNS: A `@` → 76.76.21.21; CNAME `www` → cname.vercel-dns.com |
| GitHub | Source code storage | github.com | user `wholesale30`, repo `next-owner-market` |
| Vercel | Runs the app (hosting, SSL, cron) | vercel.com (signed in with GitHub) | project `next-owner-market`, id `prj_VzFBDFjx5WS6ShwiQaiaQrxv08Ed`, team `team_VPppcRNIAlkJ0VhxfpgHfNad` |
| Supabase | Database, photo storage, logins | supabase.com | project ref `efikjdiamqzqnbifauke`, URL https://efikjdiamqzqnbifauke.supabase.co, region ca-central-1 |
| Anthropic | AI listing writer & photo sorter | console.anthropic.com | pay-as-you-go API key (~1–3¢ per item) |
| Claude (Anthropic) | Where the code gets written/changed | claude.ai, project "Warehouse items", GitHub connected | — |

**Secrets** (never paste into a public place): Supabase publishable key `sb_publishable_…`, Supabase secret key `sb_secret_…`, Anthropic key `sk-ant-…`, CRON_SECRET. All are stored in Vercel → Project → Settings → Environment Variables. If lost, each can be regenerated in its own dashboard and pasted back into Vercel; nothing else changes.

Environment variables the app reads:

```
NEXT_PUBLIC_SUPABASE_URL        https://efikjdiamqzqnbifauke.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   (publishable key)
SUPABASE_SERVICE_ROLE_KEY       (secret key)
ANTHROPIC_API_KEY               (Anthropic key)
NEXT_PUBLIC_SITE_URL            https://nextownermarket.com
CRON_SECRET                     (any long random string)
STRIPE_SECRET_KEY               (Stripe secret key, sk_live_… or sk_test_…)
SHIPPO_API_KEY                  (optional; shipping labels in-app)
RESEND_API_KEY                  (Resend key; alerts + New Arrivals email)
EMAIL_FROM                      Next Owner Market <alerts@nextownermarket.com>
optional: CLAUDE_MODEL, CLAUDE_GROUP_MODEL, STAFF_ALERT_TO,
          TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
```

## 4. How the pieces fit

```
Phone / browser
   │
   ▼
Vercel (Next.js 16 app, React 19, Tailwind 4)        ← code from GitHub main branch
   │  • storefront, staff app, API routes
   │  • daily cron → /api/notify/send
   ├──► Supabase Postgres  (all data, row-level security by role)
   ├──► Supabase Storage   (bucket "item-photos", public read)
   ├──► Supabase Auth      (email + password logins; first user ever = admin)
   └──► Anthropic API      (photo → listing; batch photo → item groups)
Background removal runs in the browser (on-device model, @imgly/background-removal); no per-photo cost.
```

## 5. Everything the app does (as of this record)

**Inventory & listing**
- Add item: photos → AI writes title, description, brand/model, category, condition, specs, tags, price range, "worth listing?" and recall/prohibited warning. Approve or edit, then list.
- Snap mode: shoot one item after another (Next item), or **Dump a batch** of up to 40 photos and the AI sorts them into items (split/merge to correct). Finish creates every draft, cleans backgrounds, writes every listing, and sends them to Review.
- Background cleanup: item cut out and placed on a plain background (color set in Settings, white default). Falls back to the original photo if the model can't find a subject.
- Bins / pallet mode: every item carries a bin/gaylord/shelf code; bins can be marked sorted with notes; per-bin counts.
- Bulk actions: select many → List, Make lot, Move bin, Print tags, Unlist, Archive.
- Lots: selected items become one listing; members reserved under it.
- QR tags: small (thermal label), 4×2, or 4×6 hang tag with description; scan opens the item page. Single or bulk.
- Copy-paste listings for Facebook Marketplace/Group, OfferUp, eBay, Craigslist. (Facebook has no posting API; Groups API was removed April 2024. Copy-paste is the only allowed path.)
- Stale flag on anything listed 30+ days.
- Statuses: draft → pending_review → active → reserved → sold → shipped; returned; archived.

**Consignment**
- Tiers and commission (on sale price only, never shipping): full service 40% (50% under $50), drop-off 30%, self-listed 15%. Per-consignor and per-item overrides. All editable in Settings.
- Consignors sign up, are approved by admin, add items (with photos and AI listing), see only their own items/sales/payouts. Items go live only after staff approval (Review queue).
- Money page: sales log, this-month sold and your take (after cost, fees, shipping), all-time, consignor balances, one-tap "Mark paid" payouts, CSV export of sales or items.

**Storefront & buyers**
- Public, searchable store with category pills (22 top categories + audio/tools/kitchen subcategories, editable in DB), sort by newest/price, per-item pages with Google Product markup (SEO), "Text about this"/"Email" buttons (uses the phone/email in Settings), share-ready links.
- Buyer accounts: save items (♡), saved-search alerts ("alert me when a Technics turntable shows up"), bid history, notifications.
- Alerts are queued automatically by a database trigger when a matching item goes active; they show in the buyer's account immediately and are emailed/texted once Resend/Twilio keys are added (cron runs daily; can be made more frequent on a paid Vercel plan).
- "Looking for something?" sourcing form → staff **Wanted** list (open/searching/matched/fulfilled; auto-matched when a matching item is listed).
- Pickup scheduling: staff open time slots; buyers request a slot from the item page; staff confirm/complete/no-show.
- Auctions: start from any item (starting bid, days, reserve, buy-now); live countdown, minimum-increment rules, 2-minute anti-snipe extension, buy-now, live updates; buyers bid with a free account; winner contacted for payment/pickup (no in-app payments yet).

**Messaging & customer list (added later the same day)**
- Facebook-style **Message about this** on every item page (name + phone/email + question; no account needed). Staff **Inbox** with unread badge, threads, canned replies, one-tap Text/Email, close/reopen. Logged-in buyers see replies under My account → Messages.
- **Subscribers**: one list of every email/phone that touches the business (store sign-up box, messages, account sign-ups, wanted requests, pickups), with source counts and CSV export for Mailchimp/Gmail/texting blasts.
- **Sign-up** creates accounts server-side, already confirmed, and signs the person straight in. No confirmation email, no Supabase Site URL/redirect settings involved.
- **Videos** on listings: uploaded clips (≤50 MB, stored in the `item-photos` bucket) or pasted YouTube/Facebook/Vimeo links; table `item_videos` (migration 004); play in the public gallery.
- **Photos**: gallery/file upload is the first option on every photo screen; camera is second.

**Checkout, payouts, plans, trust (migration 005, added the same evening)**
- **Buy now** on every active fixed-price item → Stripe Checkout (card / Apple Pay / Google Pay). Funds are held on the platform balance ("separate charges and transfers"). `orders` table tracks status: pending_payment → paid → released / refunded / disputed / cancelled.
- **Pickup**: 6-digit `pickup_code` shown to the buyer; seller enters it (`/api/orders/release`) → transfer to seller's Stripe Express account (`stripe_account_id`), `sales` row written by trigger `on_order_released`, item marked sold, seller `completed_sales` incremented. Unpicked-up orders auto-refund after 7 days (cron).
- **Ship**: seller adds tracking (`/api/orders/ship`), marks delivered → `release_after` = +3 days (cron auto-releases) or buyer taps "I received it" (`/api/orders/delivered`).
- **Refund/cancel** before hand-off (`/api/orders/refund`); **disputes** freeze funds (`disputes`, `dispute_messages`); staff resolve at /app/disputes (`/api/orders/resolve`).
- **Seller onboarding**: Stripe Connect Express (`/api/stripe/connect`); `stripe_payouts_ready` set by `account.updated` webhook. Platform-owned items (admin/staff) need no transfer.
- **Pro plan** $15/mo via Stripe subscription (`/api/stripe/subscribe`, portal at `/api/stripe/portal`); `profiles.plan`. Free users get `ai_credits` = 3 (spent server-side by `spend_ai_credit()`); copy-paste blocks, video, and unlimited listings are Pro. Enforced in DB triggers (`items_trust_guard`, `videos_plan_guard`) and API routes, not just UI.
- **Trust**: `strip_contact()` removes phones/emails/payment handles from non-staff listings; new-seller caps (5 listings / $500 until 3 completed sales); free cap 10 live; `suspended` flag; `ratings` table with `rating_avg`/`rating_count` on profiles.
- **Admin one-tap setup** (`/api/stripe/setup`, button on Money): creates the webhook endpoint (`/api/stripe/webhook`) and the Pro price; secrets stored in `settings.stripe`. Needs env `STRIPE_SECRET_KEY`. Connect must be enabled once in the Stripe dashboard (Connect → Get started).

**Alerts, email, growth (later the same evening)**
- Staff alerts (new seller, paid order, problem report, listing for review) sent instantly by Resend to `settings.business.alert_to` (Verizon text gateway 8047207910@vtext.com + gmail). Nav badges on Inbox, Orders, Review, People.
- New Arrivals email blast (`/app/blast`, `/api/blast`, Resend batch API, `blasts` table), per-subscriber unsubscribe tokens (`/unsubscribe?t=`).
- Referral credits: `signup?ref=CODE` → `apply_referral()`; when a referred user goes Pro, `on_pro_upgrade` adds a free month to the referrer (`pro_credit_months`), applied as a 100% Stripe coupon at subscribe or by the daily cron.
- Seller getting-started checklist and Share link on `/app`; Pro landing page `/pro`; nine marketplace copy blocks (added Mercari, Poshmark, Vinted, Depop, Etsy) each with a plain-language how-to-post guide (`src/lib/howto.ts`).

**Offers, labels, backups, legal (Sep 30, small hours)**
- `offers` table + `make_offer` / `respond_offer` / `buyer_offer` RPCs; 48-hour expiry; checkout accepts `offerId` and charges the accepted amount; emails via `/api/offers/notify`; badges on Offers tab.
- Shipping labels via Shippo (`src/lib/shippo.ts`, `/api/orders/label`; env `SHIPPO_API_KEY`); `orders.label_cost` subtracts from `seller_due`; ship-from address on profiles (`address1/2`) or `settings.business.address` for the store.
- Nightly JSON backup of every table to the private `backups` bucket (`src/lib/backup.ts`, run by the daily cron), 30-day retention, admin download on Settings.
- Saved-search alerts flushed the moment a listing goes live (`/api/notify/flush`).
- `/terms` and `/privacy` pages; footer and consent links.
- Public `seller_public` view (definer, public columns only) so buyers can see seller name/rating/location without profile access; `/seller/[id]` page.
- Masked messaging: `buyer_contact` column grants removed from anon/authenticated, `conversation_contact()` staff-only; `scrub_for_conversation()`; messaging requires an account.
- Database-level test suite run against production (scrub, caps, offers, messaging, order state machine, ratings, refund) — all passing as of Sep 30, 1:40 AM.

**Shipping economics (Sep 30)**
- Calculated shipping: `quoteShipping()` (src/lib/shipping.ts) rates the item's box/weight from the seller's ZIP to the buyer's ZIP via Shippo, offers ground/priority/express, and marks up by `settings.business.shipping_markup_pct` (default 20%) or `shipping_markup_min` ($1.50), rounded to 5¢. Buyer pays that; platform buys the label at the discounted rate; `orders.seller_due` excludes shipping on calculated orders where a label was bought in-app. Flat/free or self-shipped: seller keeps shipping minus label cost.
- All labels are bought on the platform's Shippo account; connect UPS/FedEx accounts there to add their rates. Env `SHIPPO_API_KEY`.

**Roles**: admin (everything incl. Settings), staff (everything but Settings), consignor (own items/payouts), buyer (account page). Enforced by Postgres row-level security, not just the UI.

## 6. Decisions and why

- **Name**: "Next Owner Market" (plain nextowner.com is a used-car dealer in Alabama; unrelated business). Tagline: *Find its next owner.*
- **Hosting**: Vercel + Supabase, both free to start, scale to ~$20–25/mo each. No WordPress, no traditional hosting. The domain points straight at Vercel.
- **Photos on plain <img>** rather than Vercel Image Optimization (metered). Supabase serves photos directly.
- **Plain white/light background** for all photos, same for all consignors (consistency, marketplace trust, no "official-looking" scam listings).
- **Money**: store sales run through Stripe with held funds (see Checkout above). Cash/Facebook sales are still recorded by hand and consignors paid from Money → Mark paid. Shipping labels and a store-listed native app are later stages.
- **AI models**: `claude-sonnet-5-5` for listing writing and photo grouping (override with env vars). Cost is pennies per item.
- **Cron** is daily because Vercel's free plan limits cron frequency.
- **eBay direct posting** is possible later (eBay has an API); Facebook is not.

## 7. Database (Supabase) — the tables

All created by `supabase/schema.sql`, then `supabase/schema_stage2.sql`, then `supabase/migrations/003_messaging_and_subscribers.sql`, `004_item_videos.sql`, `005_checkout_trust.sql`, `006_referrals_blasts.sql`, `007_seller_inbox.sql`, `008_offers_labels_backups.sql` (007/008 are summaries; full bodies are in the applied Supabase migration history) (both in the zip, run in the SQL Editor, in that order), plus a small hardening migration (`alter function … set search_path`, `revoke execute` on internal functions).

profiles · categories · locations (bins) · items · item_photos · lots · lot_members · listings (per-platform tracking) · sales (commission and consignor_due computed) · payouts · payout_sales · sourcing_requests · saved_searches · favorites · notifications · auctions · bids · pickup_slots · pickups · activity_log · settings

Functions/triggers: `handle_new_user` (auto-profile; first user = admin), `items_search_update` (full-text search), `touch_updated_at`, `is_staff`, `notify_saved_search_matches`, `on_item_activated` (fires alerts + matches Wanted requests), `place_bid` (all bidding rules in the DB), `close_ended_auctions`. Storage bucket `item-photos` (public read, signed-in upload). Realtime enabled on `auctions` and `conversations`. Migration 003 adds `subscribers`, `conversations`, `messages`, and RPCs `subscribe`, `start_conversation`, `reply_conversation`, `staff_reply`, plus auto-subscribe triggers.

## 8. Rebuild from nothing (about 30 minutes)

1. **Supabase**: New project → SQL Editor → run `supabase/schema.sql`, then `supabase/schema_stage2.sql`, then:
   ```sql
   alter function public.items_search_update() set search_path = public;
   alter function public.touch_updated_at() set search_path = public;
   revoke execute on function public.handle_new_user() from anon, authenticated, public;
   revoke execute on function public.on_item_activated() from anon, authenticated, public;
   revoke execute on function public.notify_saved_search_matches(uuid) from anon, authenticated, public;
   revoke execute on function public.current_role_name() from anon, public;
   revoke execute on function public.is_staff() from anon, public;
   revoke execute on function public.place_bid(uuid, numeric) from anon, public;
   ```
   Then run `supabase/migrations/003_messaging_and_subscribers.sql`. No Auth settings need changing (sign-up is handled server-side). Copy Project URL, publishable key, secret key.
2. **Anthropic**: console.anthropic.com → API key, add credit.
3. **GitHub**: create repo `next-owner-market`; unzip the source and push it (or upload). In Claude, connect GitHub (github.com/apps/claude → install on wholesale30) so Claude can push changes.
4. **Vercel**: Add New Project → import the GitHub repo → add the environment variables above → Deploy. Settings → Domains → add `nextownermarket.com` and `www.nextownermarket.com`.
5. **GoDaddy** DNS: A `@` → 76.76.21.21; CNAME `www` → cname.vercel-dns.com.
6. Open the site → Staff sign in → Create account (first account = admin) → People → Settings: business name, city, phone, photo background, commission tiers.
7. Restoring data: Supabase keeps backups on paid plans; on the free plan, use Money → CSV regularly, and Supabase → Database → Backups when available. Photos live in the Storage bucket.

## 9. Day-to-day operations

- **List stuff**: 📷 Snap → Dump a batch (or Shoot) → Finish → Review → Approve. Print tags. Copy the Facebook text from the item page and paste it into Marketplace and the group.
- **Sell**: item page → Mark sold → record price, channel, payment method, buyer. Consignor payout appears under Money.
- **Consignors**: People → tap → Approve; set tier/commission. Their items come to Review.
- **Helpers**: People → tap → role = staff.
- **Buyers wanting something**: Wanted tab; text or email them from the row; carry the list when buying pallets.
- **Auctions**: item page → Start an auction. Ends on its own; winner shows on their account page and in bids.
- **Pickups**: Pickups tab → open a day → buyers pick slots from item pages → confirm.
- **Changes to the app**: ask Claude in the "Warehouse items" project; it pushes to GitHub and deploys (or click Redeploy in Vercel).

## 10. Roadmap (already designed for, tables exist)

Shipping labels · eBay direct posting/delisting · email/text sending (add Resend/Twilio keys) · Facebook Page auto-posting (Meta developer app + Page token; Marketplace/Groups stay copy-paste) · reseller/lot-buyer tier with early access · referral credits · personal-shopper matching · native app store version · licensing the software to other surplus dealers.

## 11. Files in the OneDrive folder

- `next-owner-market-source.zip` — the complete source code (also on GitHub). Contains `supabase/schema.sql`, `supabase/schema_stage2.sql`, `SETUP.md`, `README.md`.
- `Next_Owner_Market_White_Paper.docx` — this document.
- `Next_Owner_Market_Marketing_Plan.docx` — the launch and growth plan.
- `Next_Owner_Market_User_Guide.docx` — the feature book / instruction manual.
- `Next_Owner_Market_Launch_Kit.docx` — 30-day launch plan.
- `Next_Owner_Market_Seller_Terms.docx` — terms draft.
- `Next_Owner_Market_Share_Message.docx` — the announcement message.
- `Their_Record_Outreach_Plan.docx` — belongs to the Their Record project; stored here too.
- Related earlier work: `Record_and_Turntable_Refurbish.md` (restoration checklist), `Facebook_Group_Handoff.md`.


## Addendum · September 30 additions

- Plain-English layer: per-screen hints (`src/lib/help.ts`, `src/components/Help.tsx`), `/help` page, `/api/ask` (Claude Haiku, grounded in the User Guide + help topics, 30 questions/hour/IP).
- Marketplace guides: `firstTime` sections + `GLOSSARY` in `src/lib/howto.ts`.
- Usernames: `profiles.username` (unique, lowercase, 3–20 chars, reserved words blocked), `username_available()` RPC, `/api/username` check, `seller_public.display_name` now prefers username; `conversations.buyer_name` auto-masked to `@username` by trigger.
- Seller tools (migration 009): `items.posted_to`, `view_count`, `save_count`, `drop_pct/drop_every_days/drop_floor/last_drop_at`; `bump_view()` (anon), `run_price_drops()` (called from the daily `/api/notify/send` cron), `item_stats` view (owner/staff only). UI in `src/app/app/items/[id]/SellerTools.tsx`.
- Seller text alerts: `profiles.sms_gateway/alert_messages/alert_orders`; `src/lib/sms.ts` (carrier email gateways via Resend); hooked into messages, offers, and paid orders.
- Buyer: `favorites` now maintains `items.save_count` and price drops queue emails to savers (`items_price_drop_alert` trigger); `WatchButton` on item page; `/api/safe-spots` (OpenStreetMap Overpass, cached 30 days in `settings`) shown on pickup orders; landing page reviews strip + How it works.
- Disputes: reporter can withdraw (`POST /api/orders/dispute { withdraw: true }`), seller can refund an open dispute, staff resolve inline on the order page.
- Shipping: built-in weight/distance ground estimate whenever Shippo isn't configured or returns nothing; estimate shows even when the seller hasn't set up payouts.
- Brand: `src/components/Logo.tsx`, green top bar, hero on `/`.

- Evening: `/why` (mission), `/start` (HowTo schema), `ToolGuide` component (FAQPage schema) on `/worth`, `/pile`, `/buy-or-pass`; `valuations` table (public read where `is_public`, owner can hide), `/api/valuations` (opt-in share; IndexNow ping), `/valued` + `/valued/[slug]` (Product/AggregateOffer schema, similar items), all in sitemap (valuations up to 20k). Shared AI engine `src/lib/ai-engine.ts`; `pile_scans`/`pile_items`/`buy_pass_scans` tables; `tax_year_summary` view; seller-scoped CSV export.

- Night: automation engine `src/lib/automations.ts` (registry table `automations`, `email_log`, `milestones`, `ops_tasks`, `profiles.marketing_opt_out`, `ops_stats()` RPC) run from `/api/notify/send` (maxDuration 300); `/api/ops` (run/toggle/task); `/app/ops` Operations page. Hub pages `/valued/about/[term]`, city pages `/near/[slug]`, OG images via `next/og` (`src/lib/og.tsx`), RSS (`src/lib/rss.ts`), embed (`/embed`, `/embed/worth`). Sitemap includes hubs (≥2 valuations sharing first two words) and cities. Complete Guide and Presentation Walkthrough documents added.
