# Setup: from zero to live

You need four free accounts. Do them in this order.

## 1. Supabase (database + photos + logins)

1. Go to supabase.com, sign up, click **New project**.
2. Name: `next-owner-market`. Database password: make one and save it. Region: **East US**.
3. Wait about a minute for it to start.
4. Left sidebar → **SQL Editor** → **New query**. Paste the whole contents of `supabase/schema.sql` and click **Run**. You should see "Success".
   Then **New query** again, paste `supabase/schema_stage2.sql`, **Run**.
5. Left sidebar → **Authentication** → **Providers** → Email: turn **Confirm email** OFF for now (so you can sign in immediately). Turn it back on later if you want.
6. **Project Settings** → **API**. Copy these three things:
   - Project URL
   - `anon` `public` key
   - `service_role` key (keep secret)

## 2. Anthropic (AI listings)

1. Go to console.anthropic.com, sign up, add **$10** credit.
2. **API Keys** → Create key → copy it.

## 3. GitHub (holds the code)

1. Sign up at github.com.
2. Create a new **private** repository named `next-owner-market`. Don't add a README.
3. Push this folder to it (Claude can do this for you if you grant access, or run the commands GitHub shows).

## 4. Vercel (runs the app)

1. Sign up at vercel.com **with your GitHub account**.
2. **Add New → Project** → pick `next-owner-market` → Import.
3. Under **Environment Variables**, add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `NEXT_PUBLIC_SITE_URL` | `https://nextownermarket.com` |
| `CRON_SECRET` | any long random string (protects the alert sender) |

Optional, whenever you want alerts to actually send: `RESEND_API_KEY` (email, free at resend.com) and `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` (texts, about a penny each). Until then, alerts still queue up and show on the buyer's Account page.

4. Click **Deploy**. About two minutes.
5. **Settings → Domains** → add `nextownermarket.com`. Vercel shows you two DNS records.

## 5. Point the domain (GoDaddy)

1. GoDaddy → My Products → your domain → **DNS**.
2. Add/edit the records Vercel showed you (usually an **A** record `@` → `76.76.21.21` and a **CNAME** `www` → `cname.vercel-dns.com`).
3. Wait 5–30 minutes. Vercel turns green when it's live.

## 6. First sign-in

1. Open your site → **Staff sign in** → **Create a consignor account** (yes, even for you).
2. **The first account ever created is automatically the admin.** Sign in.
3. Go to **People → Settings**: set business name, city, your phone (this powers the "Text about this" buttons), and check the commission tiers.
4. Tap **+ Add** and list something.

## 7. Put it on your phone's home screen

Open the site in Chrome (Android) or Safari (iPhone) → share/menu → **Add to Home Screen**. It opens like an app.

## Adding a helper or approving a consignor

**People** → tap them → set role to `staff` (or approve the consignor) → Save.

## Backups

Supabase keeps daily backups on paid plans. On the free plan, hit **Money → CSV** now and then, and you can also export from Supabase → Database → Backups.
