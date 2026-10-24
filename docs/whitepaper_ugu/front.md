# Under the Green Umbrella: App White Paper

**Everything learned building Next Owner Market, ready to build an ordering and delivery app for Under the Green Umbrella (Blacksburg, Virginia)**

Prepared by Claude for Shayne Snavely, October 24, 2026. Drop this into the new Claude project before the first message. Part 1 is the plan for her business. Part 2 is how Shayne and Claude work and the day-zero setup. Part 3 is every lesson and mistake from building Next Owner Market (Sept 29 to Oct 24, 2026), so none of them get repeated. Appendix A is the full Operating Rules.

---

## How to start the new project (paste this as the first message)

> Read the white paper in this project first, all of it. Load the shayne-operating-rules and app-builder-playbook skills. Then follow "Part 2, Day zero" in order. We're building an ordering and delivery app for my sister's business, Under the Green Umbrella in Blacksburg, Virginia: baked goods, teas, lemonades and more, at the farmers market for 30 years. Goal: people order online, she bakes and delivers on set days, and she makes good money all year instead of depending on the farmers market, which dies in winter. Ask me only the questions in "Part 1: Questions for her" that change what you build, then give me the one-screen plan, then build the whole first version.

---

# PART 1: The plan for Under the Green Umbrella

## 1.1 What we know (from Shayne, Oct 24, 2026)

- **Business:** Under the Green Umbrella, Blacksburg, Virginia. Run by Shayne's sister.
- **Kitchen and permits:** she has kitchen inspections and permits, and sells bottled tea and lemonade (per Shayne). Treat permits as handled.
- **Sells:** baked goods, teas, lemonades and more.
- **Where:** the farmer's market, for about 30 years.
- **Problem:** the farmers market slows down in winter, and she needs to make more money.
- **Goal:** move her into a custom-delivery business. Customers order online (an app and website), she bakes and delivers, and the farmers market becomes one channel instead of the whole business.

Everything else (her name on the account, menu, prices, delivery area) is unknown. **Don't guess any of it.** Ask (section 1.7) or look it up.

## 1.2 Virginia law: what she can sell and deliver (researched Oct 24, 2026)

This decides what the app may offer. It's the most important section. **It's not legal advice; confirm with VDACS** (Food Safety Program, 804-786-3520, foodsafety@vdacs.virginia.gov) **and the Town of Blacksburg** before launch.

**Home-kitchen foods (no permit or inspection under Virginia's home food processing exemption).** "Low-risk" foods that are safe at room temperature, made in her own private home. These include **baked goods**, candies, granola, dry baking mixes, **dried tea**, dried fruits, nuts, jams and jellies (not low-acid), popcorn, roasted coffee and more. *Source: Virginia's Home Food Processing Exemptions FAQ (VDACS/VDH, July 2026).*

**Online orders and delivery are now allowed in Virginia.** Since **July 1, 2026** (HB402), home producers can:
- take online orders and electronic payments;
- deliver in person, by mail or by delivery service;
- use a PO box on labels.

The FAQ says exempt products "can only be sold and delivered within the Commonwealth to individuals for their own consumption." *Sources: VDACS FAQ (July 2026); HB402 summary.* So the app's whole model works for home-baked goods:
- order online;
- pay by card;
- she delivers;
- or ship within Virginia.

**Hard limits:**
- **No shipping out of state.** The app must block non-Virginia addresses for home-kitchen items.
- **No selling to stores, cafes or anyone for resale.** That means no wholesale and no consignment. Individual customers only.
- **Some baked goods don't qualify:** anything that needs refrigeration. The FAQ names breads or cakes "filled or topped with" fresh fruit, cream cheese or similar. Cream cheese frosting and custard pies are the classic examples. These need a permit or licensed kitchen. The menu editor should have a "needs refrigeration" flag that hides an item from home-kitchen sales.
- **Her drinks are already covered.** Per Shayne (Oct 24), she has kitchen inspections and permits and has sold **bottled tea and lemonade** for years. List her drinks normally. Don't add permit checks or warnings for them.
- **Local rules still apply.** The town can add zoning or business-license rules for a home business.

**Labels (the app should print them).** Home-kitchen items need on the front:
- her name, address or PO box, and phone;
- the processing date;
- the words **"NOT FOR RESALE — PROCESSED AND PREPARED WITHOUT STATE INSPECTION."**

They also need the normal label items: product name, net weight, and ingredients (with allergens). A sign at the point of sale is OK for items too small to label. **Build a "print labels for tomorrow's orders" button** that fills all of this in automatically.

**Taxes.** Virginia sales tax on food, and whether it applies to her deliveries, is a question for her accountant. Next Owner Market held sales tax "on hold by the owner's choice." **Make it a setting, not a hard-coded rule.**

## 1.3 What the app does (first version, built complete)

**For customers (the store, phone-first):**
1. **Menu with real photos,** grouped (breads, pies, cookies, bars, teas, lemonades, seasonal). Each item shows price, size, ingredients and allergens. A "sold out this week" badge shows when it applies.
2. **Pick a delivery day.** She sets her delivery days (for example Tuesday and Friday) and an order cutoff (for example 6 PM two days before). The app only offers days she can still bake for, and stops taking orders when a day is full (she sets the limit per day).
3. **Delivery or pickup:**
   - **Delivery** is by ZIP or address within her delivery area, with a delivery fee and a free-delivery minimum (both settings).
   - **Pickup** is at the farmers market stall or another set spot.
   - Out-of-area and out-of-state addresses are refused politely.
4. **Pay by card** with Stripe Checkout (Apple Pay and Google Pay come with it). Order confirmation goes by email, plus a text when it's on the way.
5. **Repeat with one tap** ("Order this again"). Customers can also **subscribe**, for example:
   - a Weekly Bread Box, delivered every Friday, with the card charged automatically;
   - a monthly loose-tea club.

   Subscriptions are the winter money.
6. **Gifts and care packages:** "send to someone else" with a gift note. **Virginia Tech is in Blacksburg,** so "Send a care package to your student" is a natural big seller for parents. Delivered locally by her, it stays inside Virginia law.
7. **Holiday and party preorders:** Thanksgiving pies, Christmas cookie tins, office trays, graduations and VT game days. Each preorder has its own cutoff date. These fill the winter calendar.
8. **Account:** saved address, order history, allergy notes. **Sign-up comes after they've built an order** (show value first, the Next Owner Market lesson).

**For her (the owner app, phone-first, big buttons):**
1. **Today / This bake day:**
   - the **bake list** (totals per item: 14 sourdough, 6 apple pies…);
   - the **packing list** per order;
   - **🏷 Print labels** with the legal wording above.
2. **Delivery route:** today's stops in a sensible order, each with a map link, phone, notes and a **✅ Delivered** button. That button sends the customer a "Delivered!" text or email, with an optional photo.
3. **Menu editor:**
   - Add an item from a photo, and the AI writes the description (reused from Next Owner Market's listing writer).
   - Set price, size, ingredients and allergens.
   - Flag "needs refrigeration" (keeps it pickup or same-day only if needed).
   - Use the "sold out" switch and "seasonal" dates.
4. **Orders:** new, baking, out for delivery, delivered and refunded, with a one-tap refund.
5. **Customers:** list, notes, favorites, and "email everyone about the Thanksgiving pie preorder." Every email includes an unsubscribe link and her mailing address, as the law requires (CAN-SPAM).
6. **Money:** sales by day, week and item, plus subscriptions and fees. Every number opens to its list (an owner rule).
7. **To-do with twice-a-day reminders** (Part 3, the Playbook's Part 1) for permits, holiday preorder posts, and anything else she has to do herself.
8. **Settings:**
   - delivery days, cutoff, daily limit, delivery area, fee and minimum;
   - pickup spots;
   - label info and tax setting;
   - her phone and email for alerts.

**Growth that runs itself (from Next Owner Market):**
- Each menu item gets its own Google-indexable page, with a sitemap and IndexNow.
- Automatic Facebook Page posts for new items and preorders.
- A **QR code card at her market stall:** "Order for delivery: scan me." This turns 30 years of market customers into app customers.
- Holiday reminder emails to past customers.
- Review requests after delivery.

## 1.4 Screens in the order a beginner meets them

1. Home: one big button, **"Order for delivery,"** the next delivery day and cutoff, and her story ("30 years at the Blacksburg farmers market").
2. Menu, then the cart, then delivery day and address, then pay.
3. Order confirmed: celebrate it, show "Add to calendar," and offer subscribe-and-save.
4. Her side: **Today** first (bake list, labels, route), then Orders, Menu, Customers and Money under More.

## 1.5 Money and costs (from what Next Owner Market measured)

- **Stripe:** 2.9% + 30¢ a card charge, no monthly fee. Subscriptions add 0.7%.
- **Hosting:**
  - Vercel's free plan is non-commercial only. Plan on **Vercel Pro at $20/month** once she takes payments.
  - Supabase is free to start (1 GB of photos is plenty for a menu).
- **Email:** Resend's free plan covers 3,000 a month.
- **Texts:** email-to-text is free but dying (Verizon ends it March 31, 2027). Use push notifications or paid texts at about 1¢ each, but ask first.
- **AI:** pennies. Writing a menu description is about 3¢.
- **Domain:** about $20/year.
- **Budget:** about **$40/month** plus card fees, once live.

## 1.6 Build order (one push, complete)

1. Day zero (Part 2): tools, rules files, records system, database foundation, trust pages.
2. Database designed for everything above, including subscriptions, gift orders, preorder events, delivery days, labels and the to-do list, so nothing needs a rebuild later.
3. The customer store and checkout, then her Today / route / labels screens, then menu, customers, money and settings.
4. Phone-width screenshots (412px for the Fold, 360px for small phones), a signed-out sweep, a real $1 test order and refund, then send the zip.
5. Then fine-tune with her and Shayne testing like customers.

## 1.7 Questions for her (ask only the ones that change the build)

1. Her name for the account, plus the phone and email for order alerts.
2. Her permit and label details for the printed labels (business name, address, phone; whatever her permit requires on labels).
3. The menu: items, sizes, prices and photos. Can we pull from her Facebook page or market photos?
4. Delivery days, how far she'll drive (which towns or ZIPs), fee, free-delivery minimum, and max orders per day.
5. Pickup spots: her market stall days and hours, and any other spot.
6. Does she want subscriptions (bread box, tea club) and care packages for VT students from day one? (Recommended: yes.)
7. A domain name (for example undergreenumbrella.com; check availability before suggesting it), her logo and colors.
8. Who handles taxes, and does she collect Virginia sales tax now?

## 1.8 Sources for Part 1

- VAFMA 2024 Virginia Farmers Market Food Safety Summit Q&A (VDACS/VDH answers on drinks): https://vafma.org/wp-content/uploads/2024/07/2024-Food-Safety-Summit-Q-A_updated-7-24-2024.pdf
- Market Central: VDACS or VDH?: https://marketcentral.org/vdacs-or-vdh

- Virginia's Home Food Processing Exemptions FAQ (VDACS/VDH, July 2026): https://www.vdh.virginia.gov/content/uploads/sites/126/Virginias-Home-Food-Processing-Exemptions-FAQ-July-2026-1.pdf
- Virginia HB402 (cottage food online sales and delivery, effective July 1, 2026), summary: https://beancount.io/it/blog/2026/07/20/virginia-hb402-cottage-food-online-sales-shipping-guide
- VDACS home kitchen FAQ: https://www.vdacs.virginia.gov/pdf/kitchenbillfaq.pdf

---

# PART 2: How we work, and day zero

(Sections 1 to 3 of the App Builder's Playbook, unchanged. They apply to every app.)

