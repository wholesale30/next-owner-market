# Next Owner Market — The Complete Guide

*Everything the site is, what each part does, why it exists, how it works, and how it grows the business. Written so anyone can read it: an assistant running the site, a partner, a buyer of the company. September 30, 2026.*

---

## Part 1 · What this is, in one page

**The problem.** Millions of people have stuff worth money that they can't make themselves deal with. A garage, an attic, a storage unit, a parent's house, a warehouse. They know it's worth something. They don't know what, or how to sell it, or where to start, and the size of the job stops them cold. So it sits.

**The product.** Next Owner Market (nextownermarket.com) is a phone-first website that turns "I have too much stuff" into "I sold it," one box at a time:

1. **Photograph it.** One item or a whole box.
2. **It tells you what it is and what it's worth**, and whether to sell, keep, donate, or toss.
3. **It writes the listing**: title, description, price, shipping weight. In plain English, no jargon.
4. **It gives you copy-and-paste versions for nine marketplaces** (Facebook, eBay, OfferUp, Craigslist, Mercari, Poshmark, Vinted, Depop, Etsy) with a step-by-step how-to for each, written for people who've never done it.
5. **It lists it in our own store, free**, where buyers pay by card and the money is held until the buyer has the item.
6. **It handles the hand-off safely**: a 6-digit pickup code, or a shipping label bought in the app with tracking.
7. **It does the boring parts by itself**: nudges, price drops, milestones, weekly blog posts, search-engine pings, backups.

**How it makes money.** Two ways. **Pro**, $15/month, for the tools (unlimited AI listings and lookups, the nine marketplace copies, Sort the pile, video). **Commission** on store sales (15% of the item price, set per seller; 0% on the owner's own items). Listing is always free. Shipping labels carry a small margin.

**Why it can win.** The big marketplaces can't help you list on each other. The crosslisting apps have no store, no payments, no held money, no beginner guidance. And nobody has built the whole thing around the feeling of being overwhelmed. The owner has 30 years in surplus, one 25,000-square-foot warehouse and over 300 pallets; the site was built for him first.

**Where it lives.** Website only (works as a phone app from the home screen). Hosted on Vercel; database and files on Supabase; payments by Stripe; email by Resend; AI by Anthropic. Everything runs on free tiers until there's real volume.

---

## Part 2 · The public site, page by page

For each: where it is, how you get there, what it does, why it exists, how it grows the business.

### Home · nextownermarket.com
- **What:** Green hero with the one-line pitch, search box, two big buttons (What's it worth? / Sort the pile), link to Start with one box and Why we built this. Below: the "New: the AI writes your listings" card, location bar (ZIP/state/radius), category pills, sort pills, the item grid, reviews strip (once there are two), How it works (pay by card → money held → pick up or ship), subscribe box, Looking-for card, Have-stuff-to-sell card, footer with every page.
- **Why:** Buyers browse; sellers see the tool pitch first. The footer links every page so Google can crawl them all.

### Item page · /item/NOM-XXXXXX
- **What:** Photos/video gallery, price, Save (♡ with count), condition/pickup/shipping/vehicle pills, Buy now (or "Hold it with a deposit" for vehicles over the cap; or "seller hasn't set up payments" note), shipping estimate by ZIP with carrier options, Make an offer, seller line (username, rating, sales), description, specs, message-the-seller form (mic enabled). Product markup for Google; share image generated on the fly.
- **Why:** The page that sells. Every live item is a search result waiting to happen.

### Category pages · /c/turntables (110 of them)
- **What:** "Turntables for sale" headline, a sentence of real text, subcategory pills, the items, tool pitch.
- **Why:** These rank for "X for sale" searches. 27 top-level groups incl. Vehicles, Farm, Heavy Equipment, Building, Baby, Pets.

### City pages · /near/richmond-va
- **What:** Items from sellers in and around a city, auto-generated from where items are. Appears on its own once a city has items.
- **Why:** "Used tools near Richmond" searches are easy to win locally.

### What's it worth? · /worth
- **What:** Pick up to 6 photos, optional note (mic), tap. Result: what it is, era, condition, value range, retail-new, confidence, why, where it sells best (ranked, with reasons), ship-or-local, what raises the price, warning. Then **List it now** (one tap → draft listing with photos/title/description/price; buyers become sellers automatically) and **Share it (no name)** → public page. Below the tool: plain explanation, steps, examples, FAQ (Google-readable).
- **Why:** The front door for people who aren't sellers yet. 3 free, then Pro. Every shared result becomes a page Google can rank.

### Sort the pile · /pile
- **What:** Up to 10 photos of a box/shelf/corner. Result: up to 25 items, each with value range, Sell/Keep/Donate/Toss, reason, expert flag; total for sellable items. Change any label. **List N items** makes drafts for all the Sell ones. Share all valuations (no name). Guide + FAQ below.
- **Why:** The estate/garage/downsizing front door. Turns "overwhelmed" into "listed" in a minute. Feeds the store with supply.

### Buy or pass? · /buy-or-pass
- **What:** Photo + what they're asking. Result: resale range, best marketplace, that marketplace's fees (shown), shipping, profit range, BUY/MAYBE/PASS. Guide + FAQ.
- **Why:** The thrift-store demo. Great for 15-second videos. Ends in a listing.

### What things are worth · /valued, /valued/[slug], /valued/about/[term]
- **What:** Public archive of valuations people chose to share (no names). Each has its own page with value, why, where to sell, similar items, "Value mine" button, share image. Hub pages ("What is a Pioneer SX-780 worth?") build themselves once 2+ valuations share the same words: typical range, where it sells, what raises price, every example.
- **Why:** This is the self-growing search engine. Thousands of users → thousands of pages matching searches people type every day.

### Start with one box · /start
- **What:** Eight steps from "too much stuff" to "sold," each with a tip and a button to the actual screen. HowTo markup.
- **Why:** The teaching page. Linked from everywhere a stuck person lands.

### Why we built this · /why
- **What:** The mission statement in the owner's voice.
- **Why:** People buy from people. This is the story that gets shared and quoted.

### How to sell on … · /sell-on, /sell-on/ebay (nine)
- **What:** Full beginner guide per marketplace: what signup asks for, what the words mean, fees, steps, tips, glossary. HowTo markup. Tool pitch at the end.
- **Why:** "How to sell on Poshmark" is a huge evergreen search. Every guide ends with our tool.

### Blog · /blog, /blog/[slug]
- **What:** Staff-written posts plus the automatic weekly "This week on Next Owner Market" post (what people valued, what sold, what's new, a tip). Every post ends with a Start-selling card. RSS at /feed/blog.xml.
- **Why:** Google rewards sites that keep publishing. 52 automatic posts a year.

### Community · /community
- **What:** Five boards (What I found, What's it worth?, Questions, Tips, General). Posts with photos, replies, usernames only, Report on everything, contact info auto-removed, 20 posts/day limit. Staff hide/pin/lock/delete.
- **Why:** Keeps people coming back; questions become content; a board is manageable where a live chat room isn't.

### Help · /help
- **What:** Short plain-English answers grouped Selling/Buying/Shipping-pickup-safety, an Ask-anything box answered from the User Guide, scam checklist, vehicles, taxes.
- **Why:** The layperson's safety net. Also feeds the ? buttons throughout the app.

### Pro · /pro
- **What:** The tool pitch, free vs Pro, comparison to crosslisting apps, how commission works, Start free button.

### Seller page · /seller/[id]
- **What:** Username, rating, sales count, their live items.

### Embed · /embed, /embed/worth
- **What:** A free widget any website can paste in (iframe or link). Instructions for WordPress/Squarespace/Wix/Shopify.
- **Why:** Every embed is a backlink, which is what Google weighs most.

### Feeds · /feed/google.xml, /feed/items.xml, /feed/valued.xml, /feed/blog.xml, /sitemap.xml, /robots.txt
- **What:** Google Shopping product feed (with weights, condition, shipping); RSS for items, valuations, blog; sitemap of every public page (rebuilt hourly); robots that keep private pages out.

### Account pages · /account, /account/profile, /account/orders/[id], /signup, /login, /forgot, /unsubscribe
- **What:** Buyer home (offers, orders, alerts, bids, saved items), profile (username with live availability check, private name, phone, one address block, free text alerts by carrier), order page (status, pickup code, pickup picker, safe meet spots, shipping label, tracking, problem report with self-resolution, bill of sale for vehicles, ratings), email settings.

### Legal · /terms, /privacy

---

## Part 3 · The seller/staff app, screen by screen (nextownermarket.com/app)

Every screen starts with a one-line hint and a ? for more. Sellers see their own things; staff see everything plus the extra tabs.

- **🎛 Operations (staff):** numbers explained, every automation with what/why/last result/on-off/run now, the human task list with exact steps and notes, glossary. The page to hand an assistant.
- **Inventory / My items:** list with Listed/Drafts/Sold filters, search, bulk select/delete, + Add item. Sellers: "Your first sale in 10 minutes" checklist, invite-a-friend card, Ask anything box.
- **+ Add / Edit item:** photos (gallery first; clean background optional with studio look), notes box with mic, Write it for me (AI), title, brand/model, category (110), vehicle details when a vehicle category is chosen (year, miles, VIN, title status, title-in-hand), condition, description (mic), specs, tags, price with AI suggestion (never in the listing text), cost (staff), pickup/ship with weight and box, shipping mode (calculated or free), video (Pro). Save draft / List it.
- **Item page (seller view):** stats (views/saves/messages/offers) with nudge, "Also posted on" tracker with take-down reminder after sale, automatic price drop schedule, Edit, Print tag, View in store, nine marketplace tabs (Copy, How to post, Never used this app?, glossary), storefront link, description.
- **📷 Snap:** upload a pile of photos; AI groups them into items; clean backgrounds optional.
- **💬 Inbox:** conversations (usernames only), reply with mic; staff see all.
- **🛒 Orders:** open/all, Problems link (staff).
- **💸 Offers:** accept/counter/decline.
- **Payouts / Money:** Set up payouts (Stripe Express); staff: sales, consignor balances, payouts, Stripe status, Re-check.
- **📊 Year:** per-year sales/shipping/fees/commissions/labels/cost/net, CSV export, plain-English note; not tax advice.
- **Review (staff):** listings and new sellers awaiting approval; bulk approve/archive/delete.
- **Wanted (staff):** buyer requests.
- **Pickups (staff):** booked pickup slots.
- **Bins (staff):** warehouse locations.
- **📧 Email (staff):** New Arrivals blast.
- **✍️ Blog (staff):** write/publish posts; community reports queue.
- **🎁 Invites (staff):** free-Pro invite links (code, who, how long, how many uses), share sheet.
- **👤 People (staff):** every account; approve, role, plan, credits, suspend; 🎁 Give free Pro (forever or a term).
- **Settings (staff):** store name/tagline/location/contact, alert email + text, alert on all messages, store ZIP, shipping margin, vehicle card cap and deposit rules, pickup address/hours, photo background, backups.
- **Profile:** username, private name, phone, address block, text alerts by carrier, password.

---

## Part 4 · What runs by itself (and why)

All from one daily job (about 9 AM Eastern), each switchable from Operations, each recording what it did:

| Automation | What | Why |
|---|---|---|
| Health check | Tests Stripe, email, AI, Shippo, Facebook, sitemap, Google feed, IndexNow every morning; marks each OK/broken on Operations; emails staff if something that worked breaks | Nobody finds out from a customer |
| Held-money timers | Release 3 days after delivery; refund pickup orders not completed in 7 days; apply referral credits | Money never gets stuck |
| Welcome series | Day 1 "start with one box," day 3 "what's your first item worth," day 7 nudge; each once, only if they haven't done it | Turns sign-ups into sellers |
| Seller nudges | Views-no-messages → suggest price drop; 3+ saves; drafts sitting 3+ days; payout setup reminders day 1, 3, 5 after signup | Each is a reason to act |
| Milestones | First listing, 10 listings, first sale, third sale, $25/$50/$100/$500/$1,000 sold; each once, with a paste-able share line and the referral link; a text too if they turned texts on | Wins get shared; small sellers feel it early |
| Buyer weekly digest | Thursdays: every account with a ZIP gets the newest items within 100 miles | Buyers come back for the weekend |
| Seller weekly report | Mondays: views, saves, messages, offers, sales, and the one thing to do next | The habit loop |
| Win-back + Pro offer | 30 days quiet → one note; free credits hit zero → one plain explanation of Pro | Cheapest users to bring back; the right moment to upsell |
| Facebook Page | With a Page token: up to 3 new items a day and each weekly post, posted to the Page | Posting by hand stops; this doesn't |
| Staff weekly digest | Mondays: numbers, what ran, what's broken, human tasks due, in one email | Nobody has to remember to look |
| Review requests | Day after an order completes, both sides asked to rate | Trust that shows in Google |
| Weekly blog | Every Monday, a post from the week's real valuations, sales, new items | 52 pages a year, zero effort |
| Price drops | Sellers' schedules applied; savers emailed | Stuck items sell |
| Expire comps | Term-limited free Pro ends on time | Honest numbers |
| Search engines | IndexNow for everything changed; sitemap hourly; Google feed every 30 min | Found in hours |
| Backups | Every table, nightly, 30 days | Nothing lost |

Also automatic, no switch: share images for every page; hub and city pages appearing on their own; price-drop emails to savers; staff alerts (email + text) for orders, problems, messages, review, new sellers, invites; contact-info stripping; username masking in conversations; starter usernames; vehicle rules; new-seller caps lifting after three sales; Build Journal and Change Log regenerating.

Email volume is capped per day so the free tier is never exceeded; nothing is ever sent twice; anyone can turn tips off (order and payment emails always come).

---

## Part 5 · How it grows (the flywheel)

1. **Supply:** Sort the pile and Worth turn overwhelmed people into listings. The owner's own 300+ pallets seed it.
2. **Pages:** every listing, valuation, hub, city, guide, category and weekly post is a page Google can rank. The sitemap, feeds and pings make sure Google and Bing see them within hours.
3. **Links:** the embed widget, creator deals, Product Hunt and Reddit bring backlinks, which is what moves rankings.
4. **Retention:** welcome series, nudges, milestones, Year summary and the community bring people back.
5. **Sharing:** milestone lines, share images, valuation pages and the referral program (both get a month of Pro) bring the next person.
6. **Revenue:** Pro for the tools, commission on sales. Both scale with the loop above.

### The Operations page (nextownermarket.com/app/ops)

The control room, written so a brand-new hire can run the business from it. Top to bottom:

1. **Read me first**: what the business is, what this page is, the weekly routine (Monday: digest + Review + People + Problems; Thursday: New Arrivals email; any day: three Facebook groups, reports), and what to do if something looks wrong (write down what you see, tell Claude, switch the automation off meanwhile).
**🗑 Deleted (staff menu, /app/trash):** everything anyone deletes anywhere on the site is captured here and never erased: items (with their photos and videos), photos removed while editing, blog posts, community posts and replies, pickup times, invites, bins, categories, subscribers, offers. Each delete shows as one card (an item and its photos together): what it was, when, who deleted it, whose it was. **Bring it back** puts it back exactly as it was, photos included. Below that, **Archived items** (hidden but kept) can be brought back too: live again if they were listed before, otherwise to Drafts. Delete buttons now say the item goes to 🗑 Deleted instead of "for good."

**Selling before payouts are set up (Sept 30, 2026):** every listing shows Buy now from day one, whether or not the seller has finished payout setup. The buyer pays and the money is held as always. When the item is handed over, if the seller hasn't set up payouts, their share stays held and they get an email: "You sold [item]. \$X is waiting for you." Reminders go out every 3 days with the amount. The moment the seller finishes setup, everything owed is sent to their bank automatically, and the daily job double-checks each morning (automation: "Send held seller money"). Anything held 60+ days alerts staff to decide. New sellers also get payout setup reminders on day 1, 3 and 5 after signing up. The Payouts page shows sellers a green "\$X is waiting for you" box.

**What a buyer sees (every item page in the app):** a box at the top of each item says, in plain words, whether buyers can see it, whether Buy now is on (and if not, exactly why: seller hasn't set up payouts, seller paused, still a draft, waiting for approval), and whether pickup and shipping are offered. The **👁 Open as a buyer** button opens the real public page exactly as a buyer sees it; Buy now works there for the owner too, so every step can be checked. Every row in the inventory list also has a small **👁 buyer view** link.

**Owner inventory (/app, signed in as admin or staff):** every seller's items are grouped under that seller's name and @username, with a count. Your own store items come first, then sellers with the most items. A row of seller buttons across the top shows one seller at a time; "All sellers" shows everyone. The Drafts / Listed / Sold buttons work inside either view.

**Email page (/app/blast)** now has a "Who's on the list" section: every subscriber's email, name, how they joined (made an account, store signup box, messaged a seller, booked a pickup) and the date.

2. **The numbers**: 28 figures (accounts, new this week, sellers, sellers with payouts, Pro, paying Pro, items live, listed this week, drafts, waiting for approval, orders, sold all time and 30 days, our cut, problems, public valuations, piles sorted, buy-or-pass checks, blog posts, community posts, reports, subscribers, automatic emails, views, saves, invites). Tap any number and it opens to show what it means **and the actual list behind it**: the people (name, @username, email, seller/buyer, Pro or free Pro, city, date joined), the items (title, price, status, seller, views, link), the orders (item, amount, buyer, our cut, link), every automatic email sent this week (date, to whom, subject, failed or not), who saved what, every pile sorted and buy-or-pass check and by whom, every subscriber and how they joined. Nothing is a bare count anymore.
3. **What runs by itself**: every automation above, with what it does, why, how often, how many times it has run, when last, the plain result, an on/off switch, and ▶ Run now. Plus the automatic emails sent this week by type, the latest posts, and a list of the things that run with nothing to switch (sitemap, feed, pings, share images, hub/city pages, price-drop emails, staff alerts, backups).
4. **Outside the site**: every other company or service we depend on (Vercel, Supabase, GitHub, Stripe, Resend, Anthropic, Shippo, Google Search Console, Merchant Center, Business Profile, Bing/IndexNow, sitemap, Google feed, Facebook Page, Reddit, Product Hunt, creators). For each: what it is, what the site does there automatically, what a person does, who holds the login, a link, and a live status (OK / broken / human-run / not set up) from the morning health check.
5. **What customers receive, word for word**: every automatic email, when it goes, subject and body.
6. **What a person still has to do**: grouped Search / Marketing / Money / Trust / Weekly, each with what, why, exact numbered steps, a link, a notes box for the next person, and a done tick (one-time tasks fade when done; weekly/monthly ones come back).
7. **Words**: a glossary.

What a person still has to do is listed, with steps, on the Operations page (Search Console, Merchant Center, Business Profile, the demo video, Reddit, Product Hunt, creators, weekly group posts, weekly email, monthly embed outreach, Stripe check, Shippo key, review queue, problems).

---

## Part 6 · Trust and safety (how we keep people safe)

- Money held until the buyer has the item; 6-digit pickup code; mandatory in-app shipping labels with tracking.
- Real names, emails, phones never shown; usernames everywhere; contact info stripped from listings, messages and community posts.
- New-seller caps (5 listings / $500) until three completed sales; staff approval of first listings.
- Problem reports freeze the money; buyer and seller can settle it themselves (withdraw / refund); staff decide only when they can't.
- Safe meet spots (police stations) on pickup orders; scam checklist in Help.
- Vehicles: title in hand required, pickup only, deposit over the cap, printable bill of sale with real names only after payment.
- Prohibited-item screening on every AI listing; Report on everything; suspend from People.
- Ranges not promises; "estimate" never "appraisal"; Year summary is a summary, not tax advice.

---

## Part 7 · What it costs to run

$0 today. Vercel (hosting), Supabase (database/files), Resend (email, 3,000/month free), Anthropic (AI, pennies per listing; roughly 3¢ per five-photo listing), Stripe (pay-as-you-go), Shippo (pay per label). The first few Pro subscriptions cover the AI.

---

## Part 8 · Where everything is kept

- Code: GitHub `wholesale30/next-owner-market`. Hosting: Vercel `next-owner-market`. Database: Supabase `efikjdiamqzqnbifauke`.
- Documents (Word, in `docs/` and sent in chat): User Guide, White Paper (technical), Complete Guide (this), Presentation Walkthrough, Mission Statement, Tool Marketing Plan, Launch Kit, Add-On Modules paper, Seller Terms, File Index, Build Journal (every conversation), Change Log (every change).
- Rules for working on it: `CLAUDE.md` in the repo; the `shayne-operating-rules` skill on the owner's Claude account.

**Seller "Getting started" checklist:** in real order (account made → approved → ZIP → first item → live → payouts). Numbered circles; done steps show a green check and the word "Done" (nothing crossed out); one big button on the next thing the seller can do; our steps say "waiting on us."

**Running automations right now (for Claude or a developer):** besides the 9 AM daily job and the Run now buttons on Operations, there is a single-use trigger: put a random token in settings key `ops:kick` (with the list of automations, optional `catchup: true` to treat brand-new accounts as a day old, and an expiry), then call `/api/ops/kick?token=…` (the database can call it itself with pg_net). The token is erased the moment it's used. First used Sept 30, 2026 at 11:40 PM to send the first round: 6 welcome emails, 4 payout-setup reminders, 2 first-listing congratulations.

**Weight guess (Add / Edit item):** next to "Weight (lbs, packed)" there's a **✨ Guess it** button. It reads the title, description and specs and fills in the packed weight (item + box + padding, rounded up) and the box size, with a one-line reason under it. It also runs by itself when someone ticks **Will ship** and the weight is empty. It's free (no AI credit used). If the seller can weigh it, the real number is better.

**Text alerts (free, by carrier):** AT&T and Cricket shut off free email-to-text on June 17, 2025; T-Mobile, Metro and Mint stopped around December 2024; Sprint is gone. Those carriers are marked "texts not available" on Profile, the site skips them, and those people still get every alert by email. Verizon (and Xfinity, Visible, Straight Talk) still works but Verizon plans to end it by March 31, 2027; a paid text service would replace it then (ask first; about a cent a text). **Resend health:** the email key is send-only (the safe kind), so the old check showed "Broken" even while emails were delivering; Health now judges by real sends.

**Oct 1, 2026 fix: listings showed "404 page not found" to signed-out shoppers.** The database rule that lets anyone see live listings also checks "is this person staff?", and signed-out visitors weren't allowed to run that check, so the whole page failed. Fixed by letting signed-out visitors run it (it just answers "no"). Signed-in people never saw the problem, which is why it looked fine from inside the app. The daily Health check now opens a live listing as a signed-out shopper and texts/emails staff if it ever fails again.

**Oct 1, 2026 full sweep (and what it found).** Opened all 183 public pages as a signed-out visitor, checked the database's security scan, checked every live listing and order for problems, and rebuilt the code. Found and fixed: (1) listings showed "404 page not found" to signed-out shoppers (database permission); (2) category pages, city pages, the new-items feed, the share pictures, the weekly buyer digest and the Facebook posts all asked listings for a city they don't store, so they came up empty or blank; the city now comes from the seller's profile. Checked and fine: Google Shopping feed (8 items), sitemap, every listing has photos, price, category, a way to get it, and a shipping weight; no stuck orders, no open problems, no failed emails, no sellers waiting. **The sweep now runs every morning** inside Health: every sitemap page plus the feeds, opened as a shopper; anything broken or empty texts and emails staff with the list.

## The new-visitor redesign (Oct 1, 2026)

Built on how people actually decide: one obvious next step, see the value before signing up, ask for Pro only at happy moments.

**Try it free (/try).** The home page now leads with one big button: **📸 Try it free: pick a photo**. No account. The visitor picks one photo (gallery first, camera second), can add a note by typing or talking, and taps **Write my listing**. About 30 seconds later they see their title, a price range, the description, and ready-to-paste versions for all 9 sites, with "Done in 22 seconds. By hand that's 15 to 20 minutes." Then: **💾 Keep this listing (free account)** and **🏪 Bonus: list it in our store too, free.** One free try per phone (and two per network per day, 300 a day site-wide) keeps the AI bill small.

**Keep it.** Signing up from a try turns the result into the person's first draft listing, photo and all, and drops them on it with a 🎉 welcome card and one green button: **🏪 List it in the store (free)**.

**Home page.** Headline "Snap a photo. The AI writes your listing." One big button, three small links (What's it worth? · List a whole box · Overwhelmed? Start here), a 3-step "How selling works" (Snap it · AI writes it · Get paid), then "Shopping? Find something near you" with the search and the store. The top bar is just **📸 Sell · Tools · ? · Sign in** (Tools hides on narrow phones).

**AI tools page (/tools).** Every tool in plain words, biggest first: List one item (Start here), List a whole box, What's it worth?, Should I buy it?, How to post on each app, Overwhelmed? Start with one box, What things are worth. Plus a simple Free vs Pro box.

**Pro at the right moments.** Right after the AI writes a listing for a free seller: "✨ Written in 18 seconds. By hand that's about 15 minutes. 2 free AI listings left." with **⭐ Go Pro** and **Later**. When the free listings run out: "You've used your free AI listings 🎉 That means it's working for you," with Go Pro or "Not now, I'll type this one myself." Never before they've seen it work.

**Simple menus.** Sellers see 4 big tabs: **➕ Sell · 📦 My stuff · 💬 Messages · 💵 Money**. Everything else is under **☰ More**, grouped (Selling: Orders, Offers, AI tools, List a whole pile · You: Profile & alerts, Year summary, Pro, See the store, Help). When an order or offer needs them, a green bar across the top says so ("🛒 Someone bought something! Tap to see what to do."). Staff see 6 tabs (Inventory, Add, Inbox, Orders, Review, Operations) and More in three groups: Selling · Store & people · Run the business.

**Plain-English sign-up.** "Start selling, free" / "Keep your listing"; no "consignor" anywhere a newcomer looks.

**Checks that now run by themselves.**
- **Pretend new seller (weekly, Mondays; Run now on Operations):** a robot does the whole new-person path on the live site: try it free with a real photo → keep it → sign up → its first draft appears → signs in → adds another item with a photo → sends for review → approved → a signed-out shopper opens it → then it deletes everything it made. If any step breaks, staff get an alert naming the step. Its very first run found that the AI tools were failing (below).
- **Morning page sweep:** every page in the sitemap plus the feeds, opened as a signed-out shopper.
- **Morning AI test:** a real structured AI call like the tools make; alerts if the AI tools stop answering.
- **Where new people drop off (Operations):** bars for Tried it free → Kept it → Seller accounts → Added an item → Has something live → Made a sale → Paying Pro, with the % that made it from each step to the next.

**Fixed while testing (Oct 1).** The AI model in use stopped accepting the way several tools asked for their answer, so **What's it worth?, Sort the pile, Buy or pass?, the weight guess and try-it-free were all failing** (7 real Sort-the-pile attempts failed between 12:45 and 12:48 PM; credits were refunded automatically). All of them now go through one shared helper that asks the way the model accepts.

**Also fixed Oct 1:** the Google Shopping feed (what Merchant Center reads), the new-items feed and the sitemap were being saved once at build time, and the last build saved an empty Google feed. They're now made fresh on request (cached at the edge for 15 to 30 minutes), and if the database ever doesn't answer they return "try again later" instead of an empty list, so Google keeps its last good copy. The morning sweep checks that both feeds have items.

## Your to-do list (added Oct 1, 2026)

**Where:** 📝 To-do, in the staff menu bar (`/app/todo`). Only staff can see it.

**Adding things:** Type or say what you need to remember. Pick 🔴 Urgent, 🟡 Needed or ⚪ Someday, and add a due date if there is one. Under "More" you can add notes and choose how to be reminded. You can also just tell Claude, and Claude adds it.

**Reminders:** These come from the automation "To-do reminders (your assistant)", by email and text.

- **Every Monday:** the whole open list, urgent first.
- **Other days:** only when something needs you. That means due in 3 days, due tomorrow, due today, or late. Urgent items with no date come every 2 days.
- **Snooze a week** hides an item until then.
- Deleted to-dos go to 🗑 Deleted.

**In the app:** A green banner and the number on the To-do tab show how many things need you now.

**Table:** `todos`. Migration: `032_owner_todos.sql`.

## Camera on every pricing tool (Oct 1, 2026)

**What changed:** What's it worth, Buy or Pass and Sort the pile now show two big buttons: 🖼 Pick photos first, then 📸 Take a photo. Listing and Try it free already had both.

**Bug fixed:** If a signed-out visitor picked a photo on Buy or Pass or Sort the pile, nothing happened. Now they go straight to the free account page and come right back.

**Publishing note for Claude (Oct 1, 2026):** Call Vercel `create_deployment` **without** a teamId. Use project `prj_VzFBDFjx5WS6ShwiQaiaQrxv08Ed` and gitSource github `wholesale30/next-owner-market` `main`. Passing the team ID now returns "not authorized". The Vercel login is shayneforva@gmail.com (username wholesale30).

## Buy or Pass growth build and /thrift (Oct 1, 2026)

- **Signed-out visitors:** one free check per device per day, with no account. The site also allows 3 per network and 500 site-wide per day. Counters are stored in settings (`bp:ip:*`, `bp:day:*`). The photo is uploaded by the server to `item-photos/buypass/anon/`.
- **Free accounts:** 5 free checks per rolling day (`BP_FREE_DAILY` in `src/lib/thrift.ts`). After that a saved AI credit is used if they have one; if not, they see the Pro offer. Pro and staff are unlimited.
- **The answer shows** profit at every place to sell, and "best" is the place where you keep the most. It also gives gain or loss wording, "Worth it at $X or less" on a MAYBE, and how sure it is.
- **"I bought it: list it now"** (`/api/buy-or-pass/list`, `listFromScan`) makes a draft listing with the photo, price, and cost filled in. It marks the check as bought and links it to the item. Signed-out people go through signup and come back to `/buy-or-pass?claim=<id>&list=1`.
- **Share:** `/flip/<id>` is a public card with its own preview picture (`opengraph-image`). It carries the sharer's `?ref=` invite code all the way through to signup.
- **Your finds** (signed in) shows profit spotted, BUYs found, money not wasted, and a Flipper badge that starts at 1 of 10.
- **Home-screen prompt:** `src/components/InstallPrompt.tsx` shows only after a result.
- **Monday heads-up:** the "Remind me Mondays" button (`/api/thrift-reminder`) adds people to `subscribers` with interest `thrift_monday`. The automation "Monday thrift heads-up" emails them on Mondays.
- **Page `/thrift`:** for thrift and Goodwill shoppers. It includes a "Not affiliated" line. It's linked from the home page hero and footer, and it's in the sitemap.
- **Database:** `buy_pass_scans.owner_id` can now be empty (signed-out checks). New columns: `best_place`, `listing_title`, `shared`. Migration: `033_buy_pass_anon_share.sql`.

## Sharing first, and Thrift Pro (Oct 1, 2026, evening)

- **Layout:** On What's it worth, Buy or Pass and Sort the pile, the result now goes in this order: the answer, then a big **📣 Share this find** box, then **📸 Check another**, then the details. On Buy or Pass, **I bought it: list it now** sits right under Check another.
- **Every share makes a public page** at `/valued/<slug>` that Google can find. What's it worth and Sort the pile already did this. Buy or Pass now does too, through `/api/buy-or-pass/share`. That page is built from our saved result, so nobody can post their own text. After making the page, the phone's share sheet opens with the link (the `/flip` brag card for Buy or Pass, the value page for the others).
- **Privacy line** shown on every share box: "🔒 Private. No name, no email, no address, no location." That's true: public pages never show who shared. Photos are re-saved in the browser before upload, which removes the phone's location data.
- **"Your shares made N pages on Google"** appears in Your finds.
- **Thrift Pro: $3.99 a month.**
  - Gives unlimited Buy or Pass and What's it worth checks.
  - Checkout sets the price itself (`price_data` in `/api/stripe/subscribe` with `{plan:"thrift"}`), so nothing needs setting up in Stripe.
  - The webhook sets `profiles.thrift_pro` and `thrift_subscription_id` and turns it off when the subscription ends.
  - It's offered when someone runs out of free checks, and on /pro. $15 Pro stays as it is for sellers.

## Share: two clear steps, and Everyone's finds (Oct 1, 2026, 7:50 PM)

- **One tap on 📣 Share this find** puts the find on our site and shows "✓ Shared on Next Owner Market" with a link to its page. No pop-up.
- **A separate button, "Also send it to Facebook or a friend,"** opens the phone's share menu.
- **/valued is now titled "Everyone's finds."** Every share is listed there, newest first. It's linked from the share confirmation and from /thrift.
- **Where each share goes automatically:**
  - its own page;
  - the sitemap;
  - IndexNow, an instant notice to Bing, DuckDuckGo and Yahoo;
  - the Facebook Page, up to 3 finds a day, once the Page token is set.
- **Google** finds the pages through the sitemap. Search Console speeds that up, and it needs the owner's login.

**Branded pictures (Oct 1, 2026):**
- **Facebook Page posts** use the branded card, not the bare photo. The card shows the item's photo, its value or price, "Next Owner Market" and nextownermarket.com: `/valued/<slug>/opengraph-image` for finds and `/item/<sku>/opengraph-image` for listings.
- **Captions** link to the page and to the free tool (/thrift or /worth).
- **Link previews:** when anyone pastes a find's link into Facebook, a text or Messenger, the same branded card shows as the preview.

## "Something wrong? Tell it" (Oct 2, 2026)

**What it is:** a box right under the answer on What's it worth, Buy or Pass and Sort the pile. The person types or talks a correction, for example "it's the 1978 model," "missing the remote" or "you missed the drill." The same photos are checked again with that correction and the answer updates in place. No starting over, and it doesn't use a free lookup.

**How each tool handles it:**

| Tool | What the correction does | Limit |
|---|---|---|
| What's it worth (`/api/worth`) | Sends `correction` plus the previous answer. No charge. | 30 fixes per person per day |
| Buy or Pass (`/api/buy-or-pass`) | Sends `correction` plus `prev_id`. Updates the **same** check, so its share link stays the same. A share page gets remade from the corrected answer the next time it's shared. Works signed out, within 6 hours of the check. | 5 fixes per check |
| Sort the pile (`/api/pile`) | Sends `correction` plus the previous list and `prev_scan_id`. Re-sorts the same scan. | 20 fixes per day |

**What the AI is told:** trust what the person says about the item (model, condition, what's missing) unless the photos clearly show otherwise, and say in one sentence what changed.

**Where it lives:** `src/components/FixBox.tsx`.

## "Missing a part? Find it" (Oct 2, 2026)

**What it is:** every lookup (What's it worth, Buy or Pass, Sort the pile) also checks for missing or worn-out parts and shows up to 3 (1 per item on Sort the pile). For each part it shows:

- the part and its part number;
- why it matters;
- the part's price range;
- the item's value with the part.

Buy Or Pass also shows what you'd keep with the part and whether the verdict becomes BUY.

**Buttons:** "🛒 Find it on Amazon" and "Find it on eBay" are search links (`amazon.com/s?k=…`, `ebay.com/sch/i.html?_nkw=…`). Search words are cleaned: parentheses and notes like "verify model" are stripped.

**Money:** once approved, put the Amazon Associates tag in settings `business.amazon_tag` and the eBay Partner Network campaign ID in `business.ebay_campid` (or env `AMAZON_TAG` / `EBAY_CAMPID`). Links pick them up within 5 minutes. A "we may earn a commission" line appears only when an ID is set. Amazon closes new accounts that don't make 3 sales in 180 days. Signing up is an urgent item on the to-do list.

**Where it lives:** `src/lib/parts.ts` (schema, prompt, links), `src/components/PartsBox.tsx`.

## Write my listing, photo touch-up, lots (Oct 2, 2026)

**Write my listing:**
- What's it worth: the button is right under the answer. It creates the draft (title, description, price range, photos, weight, box) and opens `/app/items/<id>?written=1#copy`.
- That page shows "🎉 Your listing is written" and jumps to the copy-and-paste tabs. Facebook is first; eBay, OfferUp, Craigslist, Mercari, Poshmark, Vinted, Depop and Etsy are free for staff and Pro.
- Buy or Pass ("I bought it: write my listing") lands on the same page. The draft now gets a description built from the check.
- Sort the pile: the button sits at the top. With 1 item it lands on that listing; with more, on Drafts.

**Photo touch-up** (`src/components/PhotoEditor.tsx`, `src/lib/photo-edit.ts`):
- Runs in the browser. It's free and nothing uploads until Save.
- **Dust:** a brightness median filter finds marks that differ from the surface. It removes only small blobs whose surroundings are plain surface.
- **Lettering guard:** a row of similar-height marks side by side counts as text and stays, so model numbers and serials survive. Two passes catch clumps.
- **Light:** a gentle 65% contrast stretch (never crushes black), a lift for dark photos, and +6% color.
- **Tested** on a heavy-dust test image (1200×900, two passes in about 0.45 s): about 95% of the specks are removed, and all text plus a small indicator light are intact.
- **Where:** What's it worth photos, every photo on the item Edit page ("✨ Touch up", plus a "Touch up new photos" checkbox), and Snap mode ("Touch up every photo", on by default).
- It doesn't remove caked grime or stains. AI "deep clean" (Gemini image edit, about 3.4¢ a photo, no free tier) is offered but not built without the owner's OK.

**Lots** (`/api/worth`):
- The AI returns `pieces[]` (name, qty, value each, note, listing_title, listing_description) and `sell_advice` when the photos show 2 or more separate items. `value_low/high` and `listing` are then the whole-lot price.
- The page shows "All N together, sold as one lot," "Sold one at a time" (the total), and each piece with "List this one by itself."
- max_tokens is 5000 and maxDuration 120 s.
- **Test:** the owner's photo of 6 satellite receivers took 20 s. Lot $120–400; pieces $20–120 each, with the Drake ESR 1224 the most valuable. Advice: pull out the Drake and the Chaparral for eBay, and sell the rest locally as a lot.

## AI allowance, packs, Power Seller and AI spending (Oct 2, 2026)

**The rule lives in one place:** the database function `spend_ai_credit(profile)` is called by every AI tool before it runs.

| Who | What happens |
|---|---|
| Admin, staff, **comped** | Always allowed, never counted |
| Pro (`plan='pro'`) | `uses_count` against **300** a month (`power=true`: 1,000), reset by `uses_month` (Eastern) |
| Thrift Pro | `uses_day_count` against **30** a day |
| Free | `ai_credits` (3 at signup) |
| Everyone, after the above runs out | `extra_uses` (bought packs, never expire) |

- `refund_ai_credit` gives a use back when the AI call fails. Users can't call either function (execute revoked); the new profile columns can't be edited by users (column grants).
- **Buy or Pass:** 5 free a day for everyone signed in; checks after that are one AI use. Signed out: 1 a day per device, site cap 500.
- **Fixes:** the first 2 per lookup are free on all three tools; after that each fix is a use. Daily caps stay (30 / 20).
- **Limit reached:** the API returns 402 with `topup: true` and a plain message. The screen shows `OutOfUses` with one big "➕ Add 100 AI uses: $6.99" button, then "300 for $14.99 · See plans".
- **Meter:** `UsesMeter` on /app (sellers) and /pro, plus "N AI uses left" on What's it worth.

**Money:**
- **Packs:** `/api/stripe/topup` `{pack:100|300}` opens one-time Checkout. The webhook adds `extra_uses` once per session (`topup:<session>` in settings) and alerts staff.
- **Power Seller:** `/api/stripe/subscribe` `{plan:"power"}` charges $39/month; the price is set in code. The webhook sets `plan='pro'`, `power=true`, `power_subscription_id`, and cancels an old $15 Pro subscription so nobody pays twice.
- **Thrift Pro** checkout now reads "up to 30 checks a day."

**Real costs:**
- Every AI call writes to `ai_usage` (feature, model, tokens, cost in USD) through `logUsage` in `src/lib/usage.ts`.
- **🤖 AI spending:** `/app/ops/ai`, linked from the card at the top of Operations. It shows today, 7, 30 or 90 days, by feature and by person; tap a person to see every call. ⚠ marks anyone costing more than 60% of what they pay.
- **Automation "AI uses watch"** (daily): emails Pro members once a month at 80%, and alerts the owner once per member per month over $10.

**Cost cuts:**
- **Smaller photos for the AI** (`aiImage`, sharp, 1100px) cut each photo from 2,507 to 1,213 tokens, measured.
- **Help questions** send only the 5 User Guide sections that match the question (about 3,000 tokens instead of 14,000): about 0.5¢ a question instead of 1.3–1.8¢. Caching was tried and dropped. It saves 90% on a repeat within 5 minutes, but costs 25% extra otherwise, and our questions come far apart.
- **Buy or Pass stays on the better model.** Accuracy is the edge over the thrift apps, and the cheaper model would save only about 0.6¢ a check.
- **Overnight batch for Snap mode** (half price) is not built yet. Snap is staff-only, so it costs about $40 per 3,000 items, and batching would make you wait until morning. It's available if wanted.

**Prices in the terms** (`/terms` section 5) match all of the above.

## Price ladder and saved lookups (Oct 2, 2026)

**Price ladder** (`src/lib/ladder.ts`, `src/components/ConditionLadder.tsx`):
- **Same AI call, a few more fields.** `condition_ladder` holds `looks_dirty`, `needs_test`, the tips, and cleaned, tested and both ranges.
- **The main price is AS-IS.** `cleanLadder` drops any step that doesn't apply or adds nothing.
- **Buy or Pass** returns `ladder.{cleaned,tested,both}` with `net_low/high` and the verdict at the best place.
- **Sort the pile:** per-item `fixup`, `fixup_low/high`, `fixup_tip`.
- **Listing writers** (`/api/ai-listing`, `/api/try`, pile and worth listings) add `LISTING_HONESTY`: they say "untested" unless the owner said it works, and mention real damage. They don't force dust into the words, because sellers clean when it sells.
- **Tested on the owner's photos:** 6 receivers as-is $60–180, both $180–480. Lasko humidifier as-is $12–30, both $35–60.

**Saved lookups:**
- **The table:** `lookups` (owner, tool, title, photo_urls, hints, the full result, values, `ref_id` to buy_pass_scans or pile_scans, `item_id`, `listed_count`, soft `deleted_at`). The migration is `036_lookups.sql`.
- **Saving:** `saveLookup` in `src/lib/lookups.ts` runs from `/api/worth`, `/api/buy-or-pass` (signed in, plus claimed anonymous checks) and `/api/pile`. A fix updates the same saved lookup (by `lookup_id`, or by the scan id).
- **Inventory page (/app):** a box at the top, "📂 Saved lookups, not listed yet (N)," shows the latest 3 plus a 📝 List them button, and there's a 📂 Lookups pill before the status filters. This was added after the owner looked for his lookup in Inventory and couldn't find it.
- **Garbled answers:** now and then the AI returns `listing` as text (`<parameter name="title">…`) instead of an object. `toListing` in `/api/worth` rescues it (JSON, the parameter text, or what and why) instead of failing. That fixes the failed sandblaster lookup of Oct 2, 8:43 PM.
- **The page:** `/lookups`, with tabs To list, Listed and All; List it, List all, Open and 🗑 with Undo. The 📂 Lookups link is in the seller and staff menus and on the account page, plus "📂 My saved lookups (N)" under each tool.
- **Actions:** `/api/lookups` handles delete, restore, photos, listed and list. List works for worth (whole lot or one piece) and Buy or Pass (`listFromScan`). A pile opens so the owner picks what to sell.
- **Reopening:** `/worth?open=<id>`, `/buy-or-pass?open=<id>`, `/pile?open=<id>` load the saved result. On What's it worth, photos can be added (gallery or camera), removed or touched up, then "Re-check with the new photos" (a fix: first 2 free).
- **Older data:** existing Buy or Pass checks and piles that had an owner were copied in. What's it worth checks before Oct 2 weren't saved anywhere.

## Ideas & problems (Oct 2, 2026)

- **Public page:** `/feedback` (works signed out; optional email). Big choices are Idea or Not working; then text plus mic, an optional screenshot, and Send. `?kind=` and `?from=` pre-fill which one and the page they came from.
- **API:** `/api/feedback` saves to the `feedback` table (migration `037_feedback.sql`), stores the screenshot under `item-photos/feedback/`, limits 20 an hour per IP, and alerts staff right away (email and text).
- **Staff page:** `/app/feedback`, shown as "💡 Ideas (N new)" in the staff menu. Tabs are Open and All; each entry shows the page, screenshot and email, a note box, and 📬 New / 🛠 On it / ✅ Done / ⏸ Not now. The note and status show to the sender on `/feedback`.
- **Links:** the seller menu ("💡 Ideas & problems"), the account page, two buttons at the top of /help, and the home page footer.

## Buyer voice and "Tell it what to change" (Oct 2, 2026)

- **`BUYER_VOICE`** (`src/lib/ladder.ts`) is added to every listing writer: What's it worth, Sort the pile, the AI listing and the try-it demo. Owner notes and corrections are facts, never quoted ("seller says", "owner notes", "buyer says", earlier-answer talk). Storage dust and cleaning plans stay out unless it's real damage.
- **Condition line:** What's it worth's `listing.condition` is a buyer-facing condition line, used for the item's condition notes instead of the appraisal's `condition_guess`.
- **`/api/ai-listing/revise`:** text only, Sonnet, about 0.5–1¢, free, 60 a day per person, logged as `listing_rewrite`. It rewrites title, description and condition from a spoken or typed instruction.
- **`RewriteBox`** sits at the top of the Edit details (`#rewrite`) with mic, Rewrite and Undo. On the listing page, a "✨ Change the words" button sits by the description.
- **Tested** on a messy note-filled listing ("Seller notes… dusty… buyer says they will clean up… AI first thought"). It came back as "Lot of 4 Dell OptiPlex 7070 Desktop Computers - New Takeoffs, Never Used", with a clean 4-sentence description and the condition "New takeoffs, never used. Untested."
