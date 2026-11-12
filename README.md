# Thobe It Up

A marketplace for finding local Muslim shops and sellers — fragrance (oud, attar, cologne), modest clothing, Qurans and Islamic books, prayer essentials and more.

**Stack:** React + Vite · Supabase (auth, Postgres, storage, realtime) · Leaflet/OpenStreetMap · Netlify

## Features

- **Accounts:** sign up / log in with Google, Facebook, or email + password. Pick "buy" or "sell" at signup; anyone can become a seller later.
- **Browse & filter:** search, category, product type, *type of book* (Quran, Tafsir, Hadith, Seerah, Fiqh…), book language, men/women/kids, price, in-stock, distance radius, sort by newest/price/nearest.
- **Near me:** map + list of shops within 5–100 mi, using device location or a typed city/ZIP. Storefronts vs home sellers.
- **Shops:** profile, products by category, Message / WhatsApp / Call / Directions.
- **Contact seller:** in-app real-time chat (no in-app payments), plus WhatsApp and phone links.
- **Seller hub:** create shops, set location by address search or map pin, upload logo and up to 6 photos per product, toggle stock, edit/delete.
- **Saved items** for buyers.
- **AI support assistant (Claude):** a chat bubble on every page that answers questions, searches real listings and nearby shops, and **opens support tickets**. Replies in the customer's language.
- **AI agents:** an AI Shopper for buyers; a listing writer, price suggestions, auto-reply and draft replies for sellers; ticket triage and listing moderation for admins (details below).
- **Support tickets:** customers see and reply to their tickets at `/support`; admins handle everything at `/admin/tickets` (filter, set status and priority, reply, read the chat with the assistant).
- **Privacy:** home sellers' street address is never stored publicly; their pin is rounded to ~1 km.

## Setup (≈15 minutes)

### 1. Supabase
1. Create a new Supabase project (a separate one for this app).
2. **SQL Editor →** paste and run all of `supabase/schema.sql`. This creates tables, row-level security, the `nearby_shops` distance function, the `images` storage bucket, and turns on realtime for messages.
3. **Project Settings → API:** copy the Project URL and the `anon` public key.

### 2. Auth providers
In **Authentication → URL Configuration**:
- Site URL: `https://YOUR-SITE.netlify.app`
- Redirect URLs: add `https://YOUR-SITE.netlify.app/**` and `http://localhost:5173/**`

**Email:** on by default. (Turn off "Confirm email" under Providers → Email while testing if you like.)

**Google** (Authentication → Providers → Google):
1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* → Web application.
2. Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
3. Paste the Client ID and Secret into Supabase and enable.

**Facebook** (Authentication → Providers → Facebook):
1. developers.facebook.com → Create App → add *Facebook Login*.
2. Valid OAuth Redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
3. Make sure the `email` permission is enabled; paste the App ID and App Secret into Supabase.
4. Switch the Facebook app to **Live** mode before launch, otherwise only test users can sign in.

### 3. AI (support bot + agents)
All AI runs in **one** Supabase Edge Function, `ai-agent`, so your Claude API key never reaches the browser and Netlify drag-and-drop deploys keep working.

1. Get an API key at **console.anthropic.com** → API Keys.
2. Supabase → **Edge Functions → Secrets** → add `ANTHROPIC_API_KEY`. (Optional: `ANTHROPIC_MODEL`; default `claude-haiku-5-5`, which is fast, cheap and reads photos.)
3. Supabase → **Edge Functions → Deploy a new function → Via Editor**. Name it exactly `ai-agent`, paste in `supabase/functions/ai-agent/index.ts`, and deploy.
4. In the function's settings, turn **OFF "Verify JWT"** and save. This is required because the site uses the new publishable key; the function checks users itself.
   - CLI alternative: `supabase functions deploy ai-agent --project-ref ryohklrflcfqzzplcske` (`supabase/config.toml` already sets `verify_jwt = false`).
5. **Make yourself an admin:** sign up on the site, then run this in the SQL Editor:
   ```sql
   update public.profiles set is_admin = true
     where id = (select id from auth.users where email = 'YOUR-EMAIL');
   ```
   An **Admin** link appears in your header (Tickets + AI agent).

**What each agent does**
| Agent | Where | What it does |
|---|---|---|
| Support bot | 💬 Help bubble on every page | Answers questions, finds products/shops, opens tickets |
| AI Shopper | `/agent` | Searches and compares across shops, saves items, drafts messages to sellers (buyer approves before sending) |
| Listing writer | Add/Edit product → "Fill in with AI" | Reads the photos and writes the title, description, category and type, and suggests a price from real comparable listings |
| Seller auto-reply | Edit shop → "AI auto-reply" | Answers buyers instantly from the seller's notes and product list; labeled "Auto-reply"; stays quiet for 30 min after the seller replies; never confirms deals |
| Draft reply | ✨ button in Messages (sellers) | Drafts a reply for the seller to edit |
| Ticket triage | Every new ticket | Sets topic and priority, writes a one-line summary, next steps and a draft reply; can optionally answer simple how-to tickets itself |
| Listing moderation | Every new or edited listing | Flags scams and prohibited or counterfeit items; can hide blocked listings until an admin reviews them (`/admin/agent`) |

Toggle the agents at **/admin/agent**. To change what the bots know, edit `KNOWLEDGE` near the top of `index.ts` and redeploy.

**Limits:** per user/IP per hour: 40 support or shopper messages, 30 listing drafts, 60 draft replies, 30 auto-replies (plus 15 auto-replies per conversation per day), 5 tickets.

### 4. Run locally
```bash
cp .env.example .env    # fill in your URL + anon key
npm install
npm run dev
```

### 5. Deploy to Netlify
- Connect the repo (build command `npm run build`, publish `dist` — already in `netlify.toml`), **or** run `npm run build` and drag the `dist` folder into Netlify.
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Site settings → Environment variables (needed at build time), then redeploy.

## Customizing
- **Categories, product types, book types, languages:** `src/lib/catalog.js`
- **Colors & fonts:** CSS variables at the top of `src/index.css`
- **Default map center** (Detroit): `src/components/ShopMap.jsx`

## Project layout
```
supabase/schema.sql      database, security rules, storage, distance search, support tickets
supabase/functions/      ai-agent Edge Function (support bot + all agents)
src/lib/                 supabase client, catalog, geo helpers, chat helpers
src/context/             auth (Google / Facebook / email)
src/components/          header, cards, map, location bar, social buttons
src/pages/               Home, Browse, Product, Nearby, Shop, Messages,
                         Login, Signup, Account, Favorites, Support, AgentShopper,
                         AdminTickets, AdminAgent,
                         SellerDashboard, ShopEditor, ProductEditor
```

## Notes
- Address lookup uses OpenStreetMap Nominatim (free, low-volume). If traffic grows, swap `geocode()` in `src/lib/geo.js` for Mapbox or Google Geocoding.
- Images: max 5 MB each, stored in the public `images` bucket under each user's folder.
