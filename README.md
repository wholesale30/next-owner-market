# Next Owner Market

Phone-first inventory, consignment, and storefront app for a surplus business.
Built on Next.js + Supabase + Claude. You own the code and the data.

## What's in it (today)

- **Add item in under a minute**: snap photos, AI writes title, description, category, condition, specs, tags, and a price range. You approve.
- **Warehouse locations**: bin / pallet / gaylord codes on every item.
- **QR tags**: print small, medium, or large tags per item. Scan with any phone to open the item.
- **Copy-paste listings**: one tap for Facebook, OfferUp, eBay, Craigslist.
- **Consignment**: tiers (full service 40% / 50% under $50, drop-off 30%, self-listed 15%), per-consignor and per-item overrides, commission on sale price only.
- **Consignor logins**: they add items, you approve, they see only their own items and payouts.
- **Public storefront**: searchable, category filters, per-item pages with Google product markup, "text about this" buttons.
- **Wanted / sourcing requests**: "Looking for something?" form feeds a list you carry when buying.
- **Money**: sales log, your take, consignor balances, mark-paid payouts, CSV export.
- **Roles**: admin, staff, consignor, buyer. Row-level security in the database.
- **Built for growth**: tables already exist for auctions, bids, pickup scheduling, saved searches, favorites, notifications, lots/pallets, and per-platform listing tracking.

## Setup (about 15 minutes)

See `SETUP.md`.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```
