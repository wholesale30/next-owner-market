# Next Owner Market — The Build Journal

*A complete record of how the app was built in conversation between the owner (Shayne Snavely) and Claude, September 29, 2026 onward, and still going. Every request, every "that's wrong," every "can we add this," and what was built in response. Kept for the record, and for the book.*

---

## How to read this

Part 1 covers the first day and a half (September 29 through 3:15 AM September 30). That stretch was condensed by the system partway through, so it's reconstructed from the working notes: the owner's requests are paraphrased, the outcomes are exact.

Part 2 (3:18 AM onward on September 30) is verbatim: the owner's messages exactly as spoken (most were dictated by voice, so they read like speech), and Claude's replies exactly as written. Tool work between replies (code edits, database changes, deployments) is not reproduced line by line; the replies describe it.

Times are Eastern.

---

## Part 1 · Day one at a glance (summary)

*A short overview. Day one word for word, both sides, is at the start of Part 2. The chats that led to the idea are in the Prologue.*

### The starting point
The owner runs a surplus/consignment warehouse in Virginia and wanted a phone-first marketplace, nextownermarket.com, that he could scale nationally and eventually sell. He works from a Samsung Z Fold 6, so every screen had to be thumb-friendly and every instruction short. He set the rules early, and they were written into the project so no future session forgets them:

- Do it yourself. If something can be done from the code, the database, Vercel, Supabase, DNS, or environment variables, do it. Never send the owner into a dashboard to hunt for something unless there is no other way, and then say so in one line and give exact copy-paste values.
- Deliverables are Word documents sent as files in the chat. Never Google Drive, never links, never markdown-only.
- Keep costs at zero. No paid services without asking.
- Photos: gallery/file upload first, camera second.
- Trigger a production deployment after every push.

### What went wrong first, and what it taught
- Sign-up confirmation emails depended on a Supabase setting the owner couldn't find ("Look, it's not fucking there"). Rather than keep sending him to look, sign-up was rebuilt server-side so accounts are confirmed instantly and no email or dashboard setting is involved. This became the "do it yourself" rule.
- Nikki (the first outside seller) couldn't pick photos from her gallery; the camera opened instead. The owner: "the first menu option should be upload pictures." Fixed, and made a standing rule.
- Documents were delivered as markdown and links; the owner: "all files are supposed to be Word document downloads … give them to me like I asked." Every deliverable since has been a .docx sent in chat.
- Word files opened in a Microsoft sign-in screen on his phone; explained it was the phone's viewer, sent PDFs once as a workaround.
- An early claim that an alert email was "queued" turned out wrong (the email service rejected it before the domain was verified). Owned it; verified the domain; alerts work.

### What was built on day one
- Store with search, categories, item pages, photos and video, QR tags, print tags.
- Seller app: add item, AI-written listings from photos (title, description, specs, price range), a Snap mode for a pile of photos sorted into items, clean-background cutouts.
- Copy-and-paste listings for nine marketplaces (Facebook, OfferUp, eBay, Craigslist, Mercari, Poshmark, Vinted, Depop, Etsy) with plain-English how-to guides for each.
- Money: Stripe checkout with funds held until hand-off (pickup code or tracked delivery), seller payouts via Stripe Connect, Pro plan at $15/month, AI credits (3 free), commission on sales, ratings both ways, problem reports (disputes), refunds.
- Trust: contact info stripped from listings and messages so deals stay on the platform; masked messaging (accounts required, contacts hidden); new-seller caps (5 listings / $500 until 3 sales); prohibited-item screening.
- Alerts: staff email and free text alerts via carrier gateway (Verizon vtext); alerts for new orders, problems, listings to review, messages.
- Buyer side: accounts, saved searches, favorites, offers, order pages with pickup scheduling, order confirmation emails.
- Location: nationwide ZIP/state/radius search, distance on cards.
- Shipping: calculated shipping by weight and ZIP through the platform's own labels (Shippo), with the platform keeping a margin ("Yes… keep the margins… still charge regular rates"); calculated-or-free only, labels mandatory; extra payment methods (Cash App Pay, Link, Affirm, Klarna).
- Ops: nightly backups, bulk actions on Review and Inventory, delete items, password reset, profile page, public seller page, New Arrivals email blast, referrals (invite a seller, both get a month of Pro), terms and privacy pages.
- Documents: User Guide, White Paper, Launch Kit, Marketing Plan, Seller Terms, Share Message, File Index, a Their Record outreach plan, a turntable restoration guide.

### The owner's questions that shaped the design (paraphrased)
- "Others posting for free. How are we going to make money?" → Pro plan for the tools; commission on store sales.
- "Will users trust us with contact stripping?" → Held payments and masked messaging are the trust story; the stripping is what makes the held payment mean something.
- "Is it possible to allow videos, like Facebook does?" → Yes; video on listings, Pro feature.
- Repeated "I don't see a buy button" → traced each time (seller not payout-ready, item owned by the wrong account, row-level security hiding the seller's status); fixed with a public seller view.
- "I thought we were doing secure… they couldn't see the person's email" → messaging rebuilt so bodies are scrubbed and contacts never shown.
- Stripe setup questions answered step by step (description, categories, statement descriptor, Radar, tax, bank, Connect, key permissions). The owner: "You should know that already… multi-select."
- "Pickup scheduling doesn't say shit" → rebuilt on the paid order with real slots and a suggest-a-time thread.
- "Print tag description covered" (twice) → tag layout fixed.
- "Build this website to be national… I think this thing could be huge" → nationwide search, location on every listing.
- "Add Etsy/Poshmark/Vinted" → nine marketplaces total, each with a guide.
- "Nikki would have got these two messages?" → seller message alerts verified.
- "We buy labels… pool volume for cheaper rates" and "all shipping must go through us" → platform labels, calculated-or-free only.

### Where day one ended (3:15 AM)
Shipping lockdown deployed. The owner refreshed Nikki's GT500 lamp as a test buyer and saw no shipping estimate and no Buy button. That is where Part 2 picks up.

---

---

## Appendix A · Every document produced (current versions)

| Document | What it is | Last updated |
|---|---|---|
| Next_Owner_Market_User_Guide.docx | Instruction book: every screen, button, feature; buyers, sellers, staff; What's New section | Sept 30 |
| Next_Owner_Market_White_Paper.docx | Technical build record: architecture, database, keys (where they live), rebuild steps, Sept 30 addendum | Sept 30 |
| Next_Owner_Market_Tool_Marketing_Plan.docx | Getting eBay/Poshmark/Mercari/Facebook/Etsy sellers to use the tool: where, what to say, creators, search, 60-day cadence | Sept 30 |
| Next_Owner_Market_Launch_Kit.docx | 30-day launch: demo video, groups, creators, Product Hunt, calendar, targets | Sept 29 |
| Next_Owner_Market_Marketing_Plan.docx | Original marketing plan | Sept 29 |
| Next_Owner_Market_Seller_Terms.docx | Seller terms | Sept 29 |
| Next_Owner_Market_Share_Message.docx | Ready-to-send announcement | Sept 29 |
| Next_Owner_Market_File_Index.docx | Index of all files | Sept 29 |
| Their_Record_Outreach_Plan.docx | Outreach plan for the Their Record project | Sept 29 |
| Record_and_Turntable_Refurbish.docx | Turntable restoration guide | Sept 29 |
| Facebook_Group_Handoff.docx | Facebook group handoff | Sept 29 |
| Next_Owner_Market_Build_Journal.docx | This document | Sept 30 |

## Appendix B · Everything built on September 30 (in order)

1. Shipping estimate shown even when the seller hasn't set up payouts; built-in ground estimate (weight + distance) when live carrier rates aren't available.
2. Brand refresh: tag-and-arrow logo, green top bar with big white nav buttons, hero on the home page, higher-contrast text, real Sign out buttons.
3. Order page shows an open problem in red with staff Refund / Pay seller buttons inline.
4. Problems can be settled without staff: reporter can withdraw, seller can refund; staff only when they can't agree.
5. Plain-English layer: one-line hint on every app screen with a ? sheet; Help page with Ask anything (answers from the User Guide); "Never used this app?" sections and glossary in every marketplace guide; "Your first sale in 10 minutes" checklist.
6. Usernames: unique handles shown everywhere instead of real names; live availability check; reserved words blocked; conversations auto-masked.
7. Seller tools per item: views/saves/messages/offers, "Also posted on" tracker with take-down reminder, automatic price drops, free text alerts by carrier.
8. Buyer tools: ♡ Save with count and price-drop emails, safe meet spots (police stations near the seller) on pickup orders, reviews strip and How it works on the landing page.
9. Full category tree: 27 top-level, 110 total, including Vehicles, Farm & Ranch, Heavy Equipment, Building, Baby & Kids, Pets, Free Stuff.
10. Blog: staff editor, public pages, Start selling card on every post.
11. Community board: five boards, replies, photos, reports, staff moderation, contact stripping, 20 posts/day limit.
12. What's it worth?: photo appraisal with value range, why, where it sells best, what would raise the price, and one-tap List it now.
13. Vehicles: year/miles/VIN/title fields, title-in-hand required to go live, pickup only, deposit checkout above a configurable cap, printable bill of sale.
14. AI output hardened: structured output for appraisals; self-repair for listing JSON; price talk scrubbed from descriptions.
15. Facebook copy free for all sellers; the other eight marketplaces Pro; nine marketplaces as tabs.
16. Profile: single address block; talk-instead-of-type mic on every text box (auto-restarts, stops after 30s silence); text boxes auto-grow.
17. Photos: background clean off by default; better cutout model, soft shadow, studio gradient when used.
18. Search: sitemap.xml, robots.txt, category landing pages, Google Merchant product feed with weights, IndexNow for Bing/DuckDuckGo, Google Search Console verified, public "How to sell on…" guides for nine marketplaces.
19. Tool pitch strip on home and category pages; Pro and Worth pages say listing here is free.
20. Free Pro: give any person free Pro from People (forever or a term); invite links with uses and duration; nightly expiry.
21. Payout setup never hangs; shows Stripe's reason and logs it. Starter usernames for all new sign-ups.
