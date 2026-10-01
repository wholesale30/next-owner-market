# Next Owner Market — Add-On Modules White Paper

*Prepared September 30, 2026. Companion to*
`Next_Owner_Market_White_Paper.md` *and*
`Next_Owner_Market_Tool_Marketing_Plan.md`*. It covers which of the app
ideas researched this week fit inside Next Owner Market (NOM), how each
would be built on what already exists, what it would cost, what could go
wrong, and what to test first. Everything proposed here is a plan.
Nothing in it is built, and every table or route named below is marked
"proposed."*

*Scope: "the ones" — the researched app ideas that could be added to NOM
(confirmed by the owner, September 30).*

## 1. Bottom line

1.  **Six of the researched ideas fit inside NOM.** They share one job
    with what NOM already does: a photo goes in, the app finds the
    facts, the person confirms, and the app writes the next step. Four
    are small builds. Two carry legal or accuracy risk that needs care.
2.  **Build order we recommend:** (1) Sort the Pile, (2) Buy or
    Pass, (3) Seller Tax Tracker, (4) Grade It or Skip It, (5) Estate
    and Downsizing Pack. A sixth, the Safe Deal check, is a later add-on
    built from our inference, not from direct evidence.
3.  **Why these fit:** the owner's real surplus and consignment business
    is a credential the app-store clones lack. NOM already has the
    valuation route (`/api/worth`), the listing generator, the sales and
    expense records, AI credits and the Pro plan.
4.  **The honest risks:** price accuracy (every competitor is weak on
    vintage, toys and pottery), price-data licensing (never verified),
    and the fact that eBay, Mercari and the crosslisting tools already
    do "photo to listing." NOM should win on the guided workflow and on
    local consignment, not on the scan.
5.  **The ideas that do NOT belong inside NOM** (car dealer scanner,
    repair-quote checker, deposit vault, medical-bill fixer, family scam
    helper) are better as separate single-purpose sites that share the
    same engine. See section 9.

## 2. What NOM already has that every module reuses

From the existing White Paper and code:

| Piece                                                                                            | Where it lives                                                                    | Reused by                            |
|--------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------|--------------------------------------|
| Photo in, structured facts out, using a forced tool call so the answer always has the same shape | `src/app/api/worth/route.ts` (`tools:[{name:"appraise"…}]`, `tool_choice` forced) | All modules                          |
| AI credit charge with refund on failure                                                          | `spend_ai_credit()` RPC; free accounts get 3; Pro is unlimited                    | All modules                          |
| Confirm screen, plain-English hints, voice hints                                                 | `WorthClient.tsx`, `src/lib/help.ts`, `Help.tsx`, Mic button                      | All modules                          |
| Listing writer for nine marketplaces, with price-talk scrubbed                                   | `/api/ai-listing`, `scrubPriceTalk()`                                             | Sort the Pile, Buy or Pass, Grade It |
| Sales and expense records, QR tags, consignment commissions                                      | `sales`, `payouts`, `items`                                                       | Tax Tracker, Estate Pack             |
| Pro plan (\$15 a month), enforced in database triggers                                           | Stripe Checkout, `/pro`                                                           | Gating unlimited scans               |
| Referrals, SEO pages, blog, `/worth` as the front-door hook                                      | Tool Marketing Plan                                                               | Every module's launch                |
| Error logging to `settings`                                                                      | `worth` route                                                                     | Every module                         |

**Suggested refactor before module two:** pull the "photo, forced-schema
answer, credit charge, refund" steps out of `/api/worth` into one shared
helper (for example `src/lib/ai-engine.ts`, proposed). Each module then
becomes a schema, a prompt and a screen instead of a copy of the route.
Next.js in this repo has breaking changes from older versions, so read
the relevant guide in `node_modules/next/dist/docs/` before writing any
code (per `AGENTS.md`).

## 3. How the six were chosen

The earlier ranked report scored 10 ideas on nine weighted criteria
(instant camera result, shareable number, creator-friendly, search
demand, emotional pull, reach, safe from giants, repeat need, cost and
compliance). Those scores are our judgment, not measurements. For this
paper we kept the ideas that pass three extra tests:

1.  **It fits NOM's buyers and sellers.** The person already has stuff
    to sort, sell, price or track.
2.  **It reuses the engine.** Mostly a new prompt, a new result screen
    and a few tables.
3.  **It feeds NOM's core business,** meaning more items listed, more
    consignment, or more Pro sign-ups.

| \#  | Module                                                                         | Score in ranked report (max 120) | Fit to NOM                                 | Build size      | Legal rating |
|-----|--------------------------------------------------------------------------------|----------------------------------|--------------------------------------------|-----------------|--------------|
| 1   | Sort the Pile (inherited-box appraiser)                                        | 92 (rank 3)                      | Extends `/worth`                           | Small           | Green        |
| 2   | Buy or Pass (thrift scanner with profit after fees)                            | 84 (rank 8)                      | Uses fee knowledge of nine marketplaces    | Small           | Green        |
| 3   | Seller Tax Tracker (side-hustle and reseller)                                  | Runner-up, not in top 10         | Sits on existing sales and expense records | Small to medium | Yellow       |
| 4   | Grade It or Skip It (trading cards)                                            | 86 (rank 6)                      | New category pack on the valuation engine  | Small to medium | Yellow       |
| 5   | Estate and Downsizing Pack ("someone died" checklist plus cleanout to consign) | 86 (rank 5, checklist part)      | Feeds consignment supply                   | Small to medium | Yellow       |
| 6   | Safe Deal check (marketplace scam screen)                                      | Derived from rank 4              | Protects buyers and sellers on NOM         | Medium          | Yellow       |

The ranks for 1, 2, 4 and 5 come from the ranked report. Module 3 was a
runner-up in the research notes. Module 6 is our adaptation of the scam
helper to marketplace deals; there is no research that tests that
specific angle, so treat it as a hypothesis.

## 4. Module 1 — Sort the Pile

**What the person sees.** Photograph a box, shelf or garage corner. Get
a list of items, each with a value range and one of four labels: keep,
sell, donate, toss. A total at the top: "Sellable items: \$1,200 to
\$2,600." A button puts the best items straight into the listing flow.

**Why it fits.** This is `/worth` with more than one item per photo plus
a decision label. It feeds NOM's supply of consigned and listed goods,
and "a surplus dealer values your box" is the owner's real credential.

**Evidence.** The U.S. had 3,072,666 deaths in 2024 (CDC), each leaving
belongings behind. A 2018 estate-software vendor survey put an
executor's workload at about 570 hours (old, from a vendor). We found no
sizing of the downsizing or estate-cleanout market, no paid-demand
evidence for this exact tool and no dedicated triage app. Demand for
triage is our hypothesis. Nearby paid proof exists: CoinSnap, a coin
identifier, is estimated at about \$600,000 a month by Sensor Tower (a
vendor estimate, not audited), with \$3.99 weekly, \$9.99 monthly and
\$39.99 annual plans.

**Main warning.** Appfigures found multi-purpose identifiers were 26% of
identifier apps but only 1.4% of revenue (vendor estimate). Sell one
job, "sort this pile," not "identify anything."

**Build (proposed).**

| Item              | Detail                                                                                                                                                                                                                 |
|-------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Route             | `/api/pile` (proposed), same pattern as `/api/worth`, forced schema returning an array of items: name, category, condition, `low`, `high`, `action` (keep, sell, donate, toss), `reason`, `confidence`, `needs_expert` |
| Screen            | `/pile` (proposed): multi-photo pick, confirm each row (edit, merge, split), total, "List these"                                                                                                                       |
| Tables (proposed) | `pile_scans` (id, owner, project_name, created_at, total_low, total_high); `pile_items` (id, scan_id, name, low, high, action, confidence, item_id nullable link to `items` once listed)                               |
| Security          | RLS: owner and staff only, same pattern as `items`                                                                                                                                                                     |
| Packaging         | First scan free (uses the free credits); Pro or a one-project pass for unlimited                                                                                                                                       |
| Share card        | Total only, items blurred                                                                                                                                                                                              |

**Rules for the result.**

- Always a range, never one number, with sold-item comparisons shown
  when available. (A rival's own self-published test found its estimates
  typically \$33 off on a \$100 item, and ChatGPT was also \$33 off.
  Self-reported, conflict of interest, but it shows the size of the
  problem.)
- Flag "get an expert look" for anything that might be art, jewelry,
  firearms, coins or high-value collectibles. Never claim authenticity.
- Word it as "estimate," never "appraisal," and never "certified."

**Cheapest test.** Offer a free "scan one shelf" page to ten real
families and a few estate professionals. Measure scans per family and
how many items they list.

## 5. Module 2 — Buy or Pass

**What the person sees.** In a thrift store or at a sale, point the
camera: "Likely resale \$45 to \$70. After fees and shipping: about \$22
profit. Buy." The fee math covers the marketplaces NOM already teaches.

**Why it fits.** NOM already knows how nine marketplaces work. The new
part is a profit calculation and a fast, phone-one-handed screen. It is
a natural Pro feature and a natural "flip with me" video.

**Evidence.** ThriftAI (Profit Identifier, released June 2025) is
estimated at about \$90,000 revenue in one month (Sensor Tower, vendor
estimate), and ranked fifth Top Grossing iPhone in Shopping. Rivals
price at \$6.99 a week or \$49.99 a year (Cluzy) and \$2.99 a week or
\$59.99 a year (Pocket Pricer), per a competitor's list. There are at
least five paid scanners, plus free eBay sold listings and Google Lens.
Fees cited by the same competitor, checked September 27, 2026: eBay
13.6% plus \$0.30 to \$0.40 an order in most categories, Poshmark 20% on
sales of \$15 and up, Mercari 10% selling fee. Verify current fees
against each marketplace before hard-coding them. ThredUp's 2026 report
says U.S. secondhand apparel grew 13%, nearly four times clothing
retail.

**The honest position.** Crowded. The scan is not the edge. The edge is
what happens next: list it in one tap, track the profit, and tie the
result to the tax tracker. Every tool is weak on vintage, toys and
pottery, so show comps and a range.

**Build (proposed).**

| Item             | Detail                                                                                                                                                                          |
|------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Route            | `/api/buy-or-pass` (proposed): forced schema with item, comps used, `resale_low`, `resale_high`, `fee_model`, `net_low`, `net_high`, `verdict` (buy, pass, maybe), `confidence` |
| Fee table        | `src/lib/fees.ts` (proposed), one place to update marketplace fees; shown to the user                                                                                           |
| Input            | The person types what they would pay; the screen returns net profit and a verdict                                                                                               |
| Table (proposed) | `buy_pass_scans` (id, owner, paid, resale_low, resale_high, verdict, bought boolean, item_id nullable) so a "bought" scan becomes an inventory item with cost already filled in |
| Packaging        | Pro feature; 3 free scans                                                                                                                                                       |

**Cheapest test.** Give the free scanner to the owner's own reseller
audience and count repeat scans in a week.

## 6. Module 3 — Seller Tax Tracker

**What the person sees.** A yearly page on the sales and expenses NOM
already holds: income, cost of goods, fees, shipping, and profit. A
plain-English panel explains the forms a seller may or may not receive,
and exports a CSV or Word summary for the person's own preparer.

**Why it fits.** The data already exists (`sales`, expenses, item cost).
No new photo work. It is the strongest retention feature on the list
because the person needs it every year.

**Evidence.** The 1099-K federal threshold reverted to more than
\$20,000 and more than 200 transactions (IRS). The 1099-NEC and
1099-MISC threshold rose to \$2,000 for 2026 (IRS). Fewer forms will
arrive, but income is still taxable. Keeper charges \$199 a year
(Standard, pro-signed filing) and \$399 a year (Premium), which shows
paying customers for freelancer tax help; it targets freelancers with
bank connections. Competition is high (Keeper, Collective, Everlance,
QuickBooks Self-Employed, TurboTax). No data on how many NOM users would
care.

**Hard lines.**

- Track and explain only. **Do not prepare or file returns.** Preparing
  returns for pay needs an IRS preparer number (PTIN, \$18.75 for 2026).
- Label it "not tax advice." No "you owe" numbers presented as final.
- Do not claim to estimate quarterly payments unless the math is shown
  and the person confirms it.
- Have a CPA or enrolled agent read the explanation text before launch.

**Build (proposed).** `/app/taxes` (proposed) reads existing tables; new
`tax_notes` (id, owner, year, text) optional; a yearly summary view
(`tax_year_summary`, proposed); CSV and .docx export. No new AI call is
required for the numbers. Use AI only for the plain-English explanation.

**Cheapest test.** Show the yearly page to five active sellers at the
start of tax season and ask what they would change.

## 7. Module 4 — Grade It or Skip It (trading cards)

**What the person sees.** Photograph the front and back. See: "Likely
worth grading: about +\$180 after fees and wait. Skip: sell raw." Always
shown as ranges.

**Why it fits.** A category pack on the valuation engine plus a fee and
wait calculator. It brings hobby-forum users to NOM.

**Evidence.** PSA graded 2 million cards in 2020 and more than 19
million in 2025 (company). Its fastest tier rose from \$299 to \$349 a
card and value tiers ran 100 to 160 business days in May 2026 (company).
Five big graders set a record 3.61 million cards in July 2026 (GemRate
via Sports Illustrated, secondary). Collectr reports more than 4 million
users and "eight figures" of yearly revenue with no ad spend
(self-reported); its Pro costs \$7.99 a month. Hobby apps charge \$4.99
to \$9.99 a month or \$40 to \$60 a year. In a 30-card test by a
competing scanner vendor, Collectr got 27 right, ChatGPT's best model 26
(up to seven minutes a card) and TCGplayer's app 13. Hobby users say
ChatGPT pre-grades are reliable at 9 or below but a "10" is a toss-up
(anecdote).

**Why it is yellow.**

- **Accuracy at top grades** is unproven, and we found no verified
  accuracy for any pre-grading AI against real PSA results.
- **Price-data licensing is unverified.** We did not confirm whether
  TCGplayer, eBay or PriceCharting permit commercial use in a small app,
  or at what cost. This could block the module or add a recurring bill.
  Resolve it before building.
- **Brand rights.** Pokemon's art, names and characters are protected.
  Use plain text labels and the person's own photos; do not reproduce
  official art or logos.
- A wrong estimate costs people money. Use ranges and plain disclaimers.
  Do not build a head-on portfolio tracker; Collectr and Ludex already
  own that.

**Build (proposed).** `/api/card-check` (proposed) with front and back
photos, forced schema (card, set, condition notes, `grade_likelihood` as
ranges, `raw_value`, `graded_value`, `fee`, `wait_days`,
`net_if_graded`, `verdict`); `card_checks` table (proposed); fee and
wait figures in a config file so they update without a release. Pro
feature, 3 free checks.

**Cheapest test.** A free page in three hobby groups with 100 real
cards. Ask testers to tell us when the range was wrong.

## 8. Module 5 — Estate and Downsizing Pack

**What the person sees.** Four to six questions, then a personal
first-30-days checklist with deadlines, plus a "clean out the house"
path that uses Sort the Pile and ends in consignment with NOM.

**Why it fits.** It turns an emotional moment into NOM supply. Families
who inherit belongings need sorting, selling and pickup, which NOM
already does.

**Evidence.** About 3.07 million U.S. deaths a year (CDC). A 2026
estate-planning company survey found 42% would not know what to do if a
family member died (vendor). Competitors: Settled at \$39 once per
estate, Everplans near \$99.99 a year (both vendor figures); Empathy,
funded at \$72 million per its own announcement (the research notes also
record \$162 million raised across rounds, so confirm before quoting
either), sells through insurers. Lantern, a consumer checklist, was shut
down by its acquirer. No giant feature found. No willingness-to-pay test
exists.

**Hard lines (yellow).**

- **Unauthorized practice of law (UPL).** Virginia says no non-lawyer
  may practice law in the Commonwealth and has no safe harbor for
  software that we found (Texas does, Virginia does not). Checklists,
  agency notification letters and plain explanations are the safer zone.
  **Do not do probate court filings.** IRS Publication 559 is the
  executor tax guide; link to it rather than interpret it.
- **Get a Virginia UPL attorney opinion before charging for any
  letter.**
- Do not use "AI lawyer" language. The FTC's DoNotPay order (\$193,000
  plus a ban on unsupported "performs like a lawyer" claims) shows the
  risk.
- Privacy: death certificates and estate papers are sensitive. Keep
  storage private, delete on request, and tell the person what is kept.

**Build (proposed).** `estate_projects` (id, owner, state, created_at)
and `estate_tasks` (id, project_id, title, due_date, done, letter_text);
a rules pack in code (`src/lib/estate-rules.ts`, proposed) rather than
AI-made law; AI is used for reading a photographed letter or bill and
drafting a plain notification letter that the person sends. Offer
one-time unlock per estate rather than a subscription.

**Partners to try (no cost data):** elder-law attorneys, senior move
managers, funeral homes, estate-sale companies.

**Cheapest test.** A free checklist page offered to two funeral homes
and one elder-law office. Measure completions and requests for letters.

## 9. Module 6 — Safe Deal check (later, hypothesis)

**What the person sees.** A buyer or seller pastes a message or
screenshot from a marketplace deal and gets a plain answer ("this
matches a common overpayment scam") plus next steps.

**Basis.** The general scam helper ranked fourth in our research, but it
was built around families and older adults, not marketplace deals. The
free options are heavy: OpenAI reports about 24.7 million people and 131
million scam checks a week in ChatGPT (USA Today; no primary OpenAI
report found), and Norton's detector runs inside ChatGPT and Claude.
Free checkers were inconsistent in tests (Norton said "no red flags" on
an obvious scam email in PCMag's test). **A marketplace-specific version
is our inference, not researched.**

**Why it is yellow.** A wrong "looks safe" verdict harms someone. Show
uncertainty. Never promise refunds. Do not record calls.

**Recommendation:** add only the cheap part first, a short checklist of
common marketplace scams in the existing `/help` area, then see whether
anyone uses it.

## 10. Ideas that share the engine but should NOT live inside NOM

| Idea                                            | Why separate                    | Notes                                      |
|-------------------------------------------------|---------------------------------|--------------------------------------------|
| Dealer buyer's-order scanner (rank 1, score 97) | Different audience (car buyers) | Green; highest-ranked idea in the research |
| Repair-quote checker (rank 2, score 95)         | Different audience              | Green; price check only                    |
| Renter's deposit vault and letter (rank 9)      | State law, demand letters       | Yellow; attorney review                    |
| Family scam helper (rank 4)                     | Family plan, sensitive data     | Yellow                                     |
| Medical-bill fixer "Plainly"                    | Health data, appeals            | Researched in the health report            |

These should each get their own domain and brand, with the shared engine
module from section 2. Keeping them out of NOM protects NOM's focus and
its eventual sale value as a clean resale business.

## 11. Costs, packaging and numbers to watch

**AI cost.** Our estimate for a five-photo listing on the current
default model is about \$0.03. Treat it as an estimate and check the
real usage in the Anthropic console after the first week. A multi-item
pile scan or a two-photo card check will cost somewhat more. Keep the
free tier at 3 credits and meter the new modules through
`spend_ai_credit()`.

**Packaging.**

| Module              | Free        | Paid                       |
|---------------------|-------------|----------------------------|
| Sort the Pile       | First scan  | Pro, or one-project pass   |
| Buy or Pass         | 3 scans     | Pro                        |
| Seller Tax Tracker  | Yearly view | Pro for exports            |
| Grade It or Skip It | 3 checks    | Pro                        |
| Estate Pack         | Checklist   | One-time per-estate unlock |

The research found no willingness-to-pay data for NOM-specific pricing,
so these are starting points to test, not findings.

**Subscriptions.** The FTC click-to-cancel rule was thrown out in 2025
and the agency restarted the process in March 2026. Older law (ROSCA)
and about 30 state auto-renewal laws still apply. Keep cancellation to
one tap.

**Platform.** Stay web-first. Apple rules can reject repackaged websites
and crowded-category apps, and link-out purchases are free in the U.S.
for now, but Apple proposed a 5 to 15% fee on August 13, 2026.

**Numbers to watch** (beside the existing day-60 targets of 1,000
sign-ups and 75 Pro): scans per new user, scans that become listings,
free-to-Pro conversion per module, repeat scans in week two, and how
often users correct a range.

**Exit note.** The research found median small-app sale multiples of
about 3.9 times profit on Acquire.com and 2.93 times on Flippa, and AI
apps churn roughly 30% faster than other apps. Keeping NOM a clean
resale business with a few strong tools is easier to sell than a pile of
unrelated apps.

## 12. Legal summary

| Module              | Rating | Keep it safe by                                                         |
|---------------------|--------|-------------------------------------------------------------------------|
| Sort the Pile       | Green  | Estimates, ranges, no authenticity claims                               |
| Buy or Pass         | Green  | Show comparables and fee math                                           |
| Seller Tax Tracker  | Yellow | Track and explain only, no return preparation, not tax advice           |
| Grade It or Skip It | Yellow | Ranges, licensed data, no brand art                                     |
| Estate Pack         | Yellow | Checklists and letters only, no probate filings, attorney opinion first |
| Safe Deal check     | Yellow | Show uncertainty, no refund promises                                    |

This is research, not legal advice. Confirm with a Virginia attorney
before charging for anything legal-adjacent. Also avoid the words
"AI-powered" and "robot lawyer," call outputs "estimates," and base any
savings or profit tally on the user's own entries.

## 13. Decisions and why

- **Reuse the engine, do not clone routes.** Faster to build and one
  place to fix accuracy.
- **Ranges, not single numbers.** Every competitor is wrong by real
  money on some items.
- **Web-first, Pro-gated.** Matches the existing Stripe and Pro setup;
  avoids app-store risk.
- **Sell one job per page.** The evidence against "identify anything"
  apps is the strongest in our notes.
- **Checklists and letters, never court filings or tax returns.** Stays
  outside the law-and-tax licensing lines.

## 14. Roadmap

1.  Refactor the shared AI helper out of `/api/worth`.
2.  Sort the Pile, tested with ten families.
3.  Buy or Pass, tested with the owner's reseller audience.
4.  Seller Tax Tracker before next tax season; CPA reads the text.
5.  Card check after the price-data license question is answered.
6.  Estate Pack after the Virginia attorney opinion.
7.  Safe Deal checklist in `/help`.

## 15. Decisions for Shayne

1.  Which module first. We recommend Sort the Pile, because it is the
    smallest build and feeds consignment.
2.  Whether to pay for a one-hour Virginia attorney opinion on letters
    and the estate pack.
3.  Whether to ask a CPA or enrolled agent to review the tax
    explanations.
4.  Whether to go into trading cards at all, given the unresolved
    price-data licensing and the crowded field.
5.  Whether to start the shared-engine refactor now, or build Module 1
    first and refactor after.

## 16. What we could not verify

- No independent accuracy test of any thrift or card scanner; all
  accuracy figures are competitor-published.
- No verified price-data license terms from eBay, TCGplayer or
  PriceCharting.
- No market size for estate cleanouts or downsizing; no paid-demand test
  for Sort the Pile.
- No data on how many NOM users sell on platforms that send 1099-Ks, or
  would use a tax tracker.
- Revenue figures from Sensor Tower and Appfigures are vendor estimates
  with unlabeled dates; treat as order of magnitude.
- Whether eBay, Mercari or the crosslisters will make their own
  photo-to-listing tools better was not researched beyond eBay's
  existing feature.
- Marketplace-specific scam behavior (Module 6) was inferred, not
  researched.
- Recording-consent and state veterinary, insurance and other rules were
  not reviewed for these modules.
- Funding figure for Empathy differs between notes (\$72 million
  announcement vs. \$162 million total); confirm before quoting.

## 17. Sources

All from the research notes, retrieved September 30, 2026 unless stated.

- [CDC deaths](https://www.cdc.gov/nchs/fastats/deaths.htm) ·
  [EstateExec](https://www.estateexec.com/Docs/General_Statistics)
- [Sensor Tower:
  CoinSnap](https://app.sensortower.com/overview/1634551626?country=US)
  ·
  [ThriftAI](https://app.sensortower.com/overview/6746565278?country=US)
- [Appfigures, identifier
  apps](https://appfigures.com/resources/insights/20250509?f=1)
- [Underpriced AI, thrift apps and
  fees](https://underpricedai.com/blog/best-thrift-store-apps)
- [ThredUp 2026 resale
  report](https://ir.thredup.com/news-releases/news-release-details/thredups-14th-annual-resale-report-reveals-new-era-structural)
- [PSA investment and
  turnaround](https://www.psacard.com/articles/articleview/15715/200-million-investment-grading-experience)
  · [Sports Illustrated, July
  grading](https://www.si.com/collectibles/july-card-grading-hits-another-record-beckett-cgc-surging)
- [BetaKit on
  Collectr](https://betakit.com/how-collectr-bootstrapped-a-trading-card-hobby-into-an-eight-figure-business/)
  · [NeoSatoshi 30-card
  test](https://neosatoshi.com/blog/how-good-is-ai-at-recognizing-pokemon-cards-in-2025-0n6aotqfoty)
  ·
  [CardGrade](https://cardgrade.io/blog/may-2026-grading-volume-pre-screening)
- [Pokemon legal
  information](https://www.pokemon.com/us/legal/information) · [eBay
  acquires
  TCGplayer](https://www.ebayinc.com/stories/news/ebay-has-entered-into-an-agreement-to-acquire-tcgplayer/)
  · [Retail Dive, eBay magical
  listing](https://www.retaildive.com/news/ebay-ai-magical-listing-product-descriptions-listings/693185/)
- [IRS 1099-K
  FAQs](https://www.irs.gov/newsroom/form-1099-k-faqs-general-information)
  · [Keeper pricing](https://www.keepertax.com/pricing) · [IRS
  PTIN](https://www.irs.gov/tax-professionals/ptin-requirements-for-tax-return-preparers)
  · [IRS Publication 559](https://www.irs.gov/publications/p559)
- [Settled](https://settledestate.com/executor-software/) ·
  [Empathy](https://www.empathy.com/blog/empathy-series-c-announcement)
  · [Wellthy on Lantern](https://wellthy.com/lantern) · [Trust & Will
  survey](https://www.prnewswire.com/news-releases/trust--wills-2026-estate-planning-report-56-of-americans-still-have-no-estate-plan-ai-trust-hits-an-all-time-high-302735330.html)
- [Virginia State Bar, unauthorized
  practice](https://vsb.org/Site/Site/lawyers/unauthorized-practice.aspx)
  · [FTC DoNotPay
  order](https://www.ftc.gov/news-events/news/press-releases/2025/02/ftc-finalizes-order-donotpay-prohibits-deceptive-ai-lawyer-claims-imposes-monetary-relief-requires)
  · [Jones Day on
  click-to-cancel](https://www.jonesday.com/en/insights/2026/05/ftc-revives-clicktocancel-rule-new-risks-for-subscription-businesses)
- [USA Today on ChatGPT scam
  checks](https://www.usatoday.com/story/tech/2026/09/16/openai-aarp-ai-scam-road-tour/91781681007/)
  · [PCMag scam
  tools](https://www.pcmag.com/picks/the-best-scam-protection-tools)


---

## Status update — September 30, 2026, evening (Claude)

Built and live the same day the paper was received:

| Module | Status | Where |
|---|---|---|
| Shared AI engine | **Built** | `src/lib/ai-engine.ts` (`runVision()`: forced-schema tool call, credit charge with refund on failure, error log); `FEES` table for marketplace fee math |
| 1 · Sort the Pile | **Built** | `/pile` page, `/api/pile`; tables `pile_scans`, `pile_items` (RLS owner/staff); up to 10 photos, up to 25 items, keep/sell/donate/toss with reasons, expert flag, total for sellable items, "List N items" creates drafts with photo/title/description/price |
| 2 · Buy or Pass | **Built** | `/buy-or-pass` page, `/api/buy-or-pass`; `buy_pass_scans` table; verdict BUY/MAYBE/PASS from resale range − fees − shipping − price paid; fee schedule shown |
| 3 · Seller Tax Tracker | **Built** as "Year summary" | `/app/taxes` (📊 Year in the app nav), view `tax_year_summary` over existing `sales`/`items`; per-year CSV export for the seller's own sales; plain-English panel, explicit "not tax advice, we don't file" |
| 6 · Safe Deal | **Built** (cheap version) | "How do I spot a scam in a marketplace deal?" in Help |
| 4 · Grade It or Skip It | **Held** | Until price-data licensing (eBay/TCGplayer/PriceCharting) is resolved |
| 5 · Estate Pack | **Researched, ready to build** (Oct 1, 2026) | Full Virginia + federal legal research done: see *Estate & Downsizing Pack: Legal Research Report*. Six narrow questions remain for one short attorney consult; build stays inside the safe zone (checklists, official-form links, notice-only letters, no legal path chosen for the family) |

Packaging as proposed: each module uses the existing AI credits (3 free, Pro unlimited); the tax page is free. All three tools are linked from the home-page tool strip, the footer, and the sitemap. Legal wording follows section 12: "estimates," ranges, expert flags, no authenticity claims, no tax advice.
