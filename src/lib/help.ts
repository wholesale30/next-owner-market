/** Plain-English help. One sentence per screen (hints) and short answers (topics). Written for someone who has never sold online. */

export const SCREEN_HINTS: { match: RegExp; text: string; topic?: string }[] = [
  { match: /^\/app$/, text: "This is your stuff. Tap + Add to list something new. Tap an item to see it, change the price, or copy it to Facebook and eBay.", topic: "my-items" },
  { match: /^\/app\/items\/new/, text: "Add photos first (pick from your gallery). Then tap Write it for me and the AI fills in the title, description, and price.", topic: "add-item" },
  { match: /^\/app\/snap/, text: "Got a pile? Upload photos of everything at once. We sort them into items and write each listing.", topic: "snap" },
  { match: /^\/app\/inbox/, text: "Questions from buyers land here. Reply like a text. Nobody sees your phone or email.", topic: "messages" },
  { match: /^\/app\/orders/, text: "Someone bought something. Tap the order to hand it over (pickup code) or print a shipping label.", topic: "orders" },
  { match: /^\/app\/offers/, text: "Buyers offering less than your price. Accept, counter, or pass.", topic: "offers" },
  { match: /^\/app\/money/, text: "Where your money goes. Set up payouts once and card payments go straight to your bank.", topic: "payouts" },
  { match: /^\/app\/items\/[^/]+\/edit/, text: "Change anything here. Price, photos, whether you'll ship. Save at the bottom.", topic: "add-item" },
  { match: /^\/app\/items\/[^/]+$/, text: "Your listing. Scroll down for copy-and-paste versions for Facebook, eBay, and the rest, plus a how-to for each one.", topic: "crosspost" },
  { match: /^\/app\/taxes/, text: "Your year in numbers: sales, fees, costs. Download it for whoever does your taxes. We don't file anything.", topic: "taxes" },
  { match: /^\/app\/ops/, text: "The control room. Numbers at the top, what runs by itself in the middle, what a person still has to do at the bottom. Tap any number to see what it means." },
  { match: /^\/app\/settings/, text: "Store settings. Your address, hours, who gets alerts, and fees.", topic: "settings" },
  { match: /^\/app\/review/, text: "New listings and new sellers waiting for your OK. Tap to approve.", topic: "review" },
  { match: /^\/app\/people/, text: "Everyone with an account. Tap a person to approve, change their plan, or pause them." },
  { match: /^\/app\/blast/, text: "Send a New Arrivals email to your subscribers. Pick items, write a line, send." },
  { match: /^\/app\/trash/, text: "Anything deleted anywhere lands here. Tap Bring it back to undo. Nothing here is ever erased." },
  { match: /^\/thrift/, text: "Snap it, type the tag price, tap Buy or pass. First one is free with no account." },
  { match: /^\/app\/todo/, text: "Type or say anything you need to remember. Pick Urgent, Needed or Someday. Tap the green check when it's done." },
  { match: /^\/app\/pickups/, text: "Pickup appointments buyers booked." },
];

export type HelpTopic = { id: string; q: string; a: string[]; who?: "seller" | "buyer" | "all" };

export const TOPICS: HelpTopic[] = [
  { id: "start", who: "seller", q: "How do I sell something?", a: [
    "Tap + Add. Pick a few photos from your gallery. Tap Write it for me: the AI writes the title, description, and a price. Tap List it.",
    "Your item shows up in the store. When someone buys it, you get a message and the money is held until they have it.",
    "First 3 AI listings are free. After that Pro is $15/month for 300 a month, or write them yourself for free.",
  ] },
  { id: "add-item", who: "seller", q: "What do the boxes on the Add item screen mean?", a: [
    "Photos: pick from your gallery. The first one is the main picture.",
    "Title: what it is, in a few words. Brand, model, size. \"Craftsman 19.2V drill with battery.\"",
    "Price: what you want for it. Buyers can make offers if you turn that on.",
    "Pickup / Ship: can a buyer come get it, mail it, or both? For shipping, put in the weight and pick a box size; we figure out the shipping cost for the buyer.",
    "Condition: be honest. Scratches, missing parts. Honest listings sell faster and don't come back.",
  ] },
  { id: "snap", who: "seller", q: "What is Snap?", a: [
    "Snap is for a pile of stuff. Take photos of everything, then upload them all at once.",
    "We group the photos that belong to the same item, clean up the backgrounds, and write a listing for each one. You just check them and tap List.",
    "It's a Pro feature after your free ones are used up.",
  ] },
  { id: "my-items", who: "seller", q: "What do Draft, Listed, and Sold mean?", a: [
    "Draft: you started it but it's not in the store yet.",
    "Listed: buyers can see it and buy it.",
    "On hold: someone paid and it's waiting for pickup or shipping.",
    "Sold: done. The money went to you.",
  ] },
  { id: "payouts", who: "seller", q: "How do I get paid?", a: [
    "Go to Payouts and tap Set up payouts. It asks for your name, address, and bank account (or debit card). Takes about 5 minutes. This is done by Stripe, the same company that handles payments for Amazon and Shopify.",
    "After that, every time something sells, the money lands in your bank about 2 business days after the buyer has the item.",
    "Your items can sell before you set this up. If something sells first, we hold your money safely and send it the moment you finish.",
  ] },
  { id: "fees", who: "seller", q: "What does it cost?", a: [
    "Listing is free. When something sells in the store, we keep a small percentage of the sale price (shown on your item before you list). Shipping is paid by the buyer and isn't part of it.",
    "Pro is $15/month: 300 AI uses a month (listings, lookups, piles), copy-and-paste for 9 other sites, and video. Need more? Packs of 100 for $6.99 never expire, or Power Seller ($39) for 1,000 a month.",
  ] },
  { id: "orders", who: "seller", q: "Someone bought my item. Now what?", a: [
    "Pickup: message the buyer to set a time and place. When they show up, they'll have a 6-digit code on their phone. Type it into the order and tap Release. Money's yours.",
    "Shipping: open the order, tap Buy label, print it (any printer, or the library), tape it on, drop it at the post office. Tracking is automatic. Money's yours 3 days after it's delivered.",
    "Don't hand anything over without the code, and don't ship without the label from here. That's what protects you.",
  ] },
  { id: "offers", who: "seller", q: "What's an offer?", a: [
    "A buyer says \"would you take $40 instead of $50?\" You can accept, send back a different number, or say no.",
    "If you accept, they have 24 hours to pay. If they don't, the item goes back up.",
  ] },
  { id: "messages", who: "seller", q: "Can buyers see my phone number or email?", a: [
    "No. Messages go through the site. Your number, email, and address are never shown.",
    "You get an email (or text, if you turn it on in Profile) each time someone writes.",
    "Do the deal here. If someone asks you to text them or pay outside the site, that's usually a scam.",
  ] },
  { id: "crosspost", who: "seller", q: "How do I put my item on Facebook, eBay, or the others?", a: [
    "Open your item. Scroll to the copy blocks. Tap Copy under the site you want.",
    "Tap the How to post button next to it. It walks you through that app screen by screen: where the Sell button is, what to tap, what to paste.",
    "Photos: save them to your phone from the item page, then pick them in the other app.",
    "When it sells anywhere, tap Mark sold on your item. We'll remind you to take it down from the other sites.",
  ] },
  { id: "shipping", who: "all", q: "How does shipping work?", a: [
    "The buyer sees the shipping price before they buy; it's based on the item's weight and their ZIP.",
    "The seller buys the label right on the order (the buyer's shipping money covers it), prints it, and drops the package off. The buyer gets tracking automatically.",
    "Free shipping means the seller covers the label cost out of the sale.",
  ] },
  { id: "buy", who: "buyer", q: "How do I buy something?", a: [
    "Tap Buy now. Pick pickup or shipping. Pay by card, Apple Pay, Google Pay, Cash App, or pay later with Affirm or Klarna.",
    "Your money is held. It only goes to the seller after you have the item.",
    "Pickup: you get a 6-digit code. Give it to the seller when you have the item in your hands. Not before.",
  ] },
  { id: "protection", who: "buyer", q: "What if something goes wrong?", a: [
    "Open the order and tap Report a problem. The money stays frozen.",
    "Talk it out with the seller in the message thread. Most things get sorted. If not, our staff decide, and you get a full refund if the item isn't as described or never showed up.",
    "Pickup orders not completed within 7 days refund automatically.",
  ] },
  { id: "safety", who: "all", q: "Meeting up: how do I stay safe?", a: [
    "Meet in a public place in daylight. Police stations have marked Safe Exchange Zones; we suggest ones near the seller on the order page.",
    "Bring a friend. Test the item before you hand over the code.",
    "Never pay outside the site. The code and the held money are your protection.",
  ] },
  { id: "worth", who: "all", q: "What's it worth? How does that work?", a: [
    "Tap Worth? at the top. Pick photos of the item (the whole thing, then labels and any damage). Tap What's it worth?",
    "You get what it is, a price range, what drives the value, and where it sells best. If you want to sell it, tap List it now and the listing is already written.",
    "3 free lookups; Pro gives you 300 AI uses a month. It's an estimate from photos, not an in-person appraisal; rare or valuable pieces deserve a specialist too.",
  ] },
  { id: "vehicles", who: "all", q: "Selling or buying a car, boat, or motorcycle here?", a: [
    "Sellers: list it like anything else, plus year, miles, VIN, and title status. You must have the title in hand. Vehicles are pickup only.",
    "Buyers: under the cap (usually $5,000) you pay the full price by card and it's held like any order. Above it, you put down a small deposit by card that holds it for 7 days; you meet, look it over, pay the balance in cash or cashier's check, and both sign the bill of sale the site prints.",
    "If the sale doesn't happen within 7 days, the deposit comes back to the buyer automatically. Report a problem freezes it like any order.",
  ] },
  { id: "taxes", who: "seller", q: "Do I owe taxes on what I sell here?", a: [
    "We can't tell you that; we're not tax advisers and we don't file anything. What we do: the Year page in your app adds up your sales, fees, shipping, and what you paid for items, so you can hand it to whoever does your taxes.",
    "General rule of thumb: selling your own used stuff for less than you paid is usually not income. Buying to resell at a profit usually is. Keep receipts.",
    "Whether a marketplace sends you a 1099-K depends on the year's threshold and your state. Not getting a form doesn't change what's taxable.",
  ] },
  { id: "scams", who: "all", q: "How do I spot a scam in a marketplace deal?", a: [
    "Anyone who wants to move the deal off the site (text me, pay my Venmo, I'll send a courier) is the number one sign. On Next Owner Market every real deal goes through checkout; the money is held, so there's nothing to gain by going around it.",
    "Overpayment: they send more than the price and ask you to refund the difference. The original payment bounces later. Never refund outside the site.",
    "Fake payment screenshots or fake payment emails. Only trust what your order page shows.",
    "Rush and pressure: my mover is coming today, I'm deployed overseas, my nephew will pick it up. Slow down.",
    "For pickups: meet in public, daylight, at a police safe-exchange spot (we list them on the order). Don't hand over the item until you enter the buyer's code; don't give your code until the item is in your hands.",
    "If something feels off, use Report a problem on the order. The money freezes and staff look.",
  ] },
  { id: "review", who: "seller", q: "Why does my listing say pending?", a: [
    "We look at every new seller's first listings before they go live. Usually same day. After a few good sales, listings go live immediately.",
  ] },
  { id: "settings", who: "seller", q: "Where do I change my address or turn on text alerts?", a: [
    "Tap Profile at the top. City, state, ZIP, and how you want to be alerted are all there.",
  ] },
];

export function hintFor(path: string) {
  return SCREEN_HINTS.find((h) => h.match.test(path)) || null;
}
