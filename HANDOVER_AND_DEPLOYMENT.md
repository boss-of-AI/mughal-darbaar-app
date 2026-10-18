# Client Onboarding, Deployment & Ownership Handover Guide

This master template is designed for a repeatable, one-time setup business model: each restaurant client gets their own independent codebase copy, database, hosting instance, and Razorpay merchant integration.

---

## 1. Customizing for a New Restaurant Client (15 Minutes)

1. **Duplicate the Master Template**
   ```bash
   cp -r restaurant-app client-restaurant-name
   cd client-restaurant-name
   ```
2. **Update Central Brand Configuration**
   Edit `src/config/restaurant.config.ts`:
   - `name`, `tagline`, `description`, `cuisine`
   - `phone`, `email`, `address` (and Google Maps link)
   - `hours` (`weekdays`, `weekends`)
   - `services` (`delivery`, `pickup`, `dineIn`)
   - `ordering` (`minimumOrderAmount`, `deliveryFee`, `freeDeliveryAbove`, `gstPercent`)
   - `brand` color tokens (or update `--color-primary` in `src/app/globals.css`)
3. **Update Initial Seed Data**
   Edit `src/lib/db/seed.ts` with the client's categories, dishes, Half/Full variants, number of dine-in tables, and initial owner email/password.

---

## 2. Database Setup & Seeding

1. Provision a PostgreSQL instance (Railway PostgreSQL or Supabase PostgreSQL).
2. Set `DATABASE_URL` in `.env.local` (for local setup) or in the hosting dashboard.
3. Push the schema and seed the initial menu, tables, and owner account:
   ```bash
   npm run db:push
   npm run db:seed
   ```

---

## 3. Deploying to Railway Hobby (Default) or Vercel + Supabase

### Option A: Railway Hobby (~₹700–₹1,000/month, paid by restaurant owner)
1. Have the restaurant owner create a Railway account and add a payment card.
2. Create a new project in Railway → **Add PostgreSQL**.
3. Deploy the GitHub repository into the same Railway project.
4. Add the environment variables in the Railway service:
   - `DATABASE_URL` (reference `${{Postgres.DATABASE_URL}}`)
   - `AUTH_SECRET` (generate with `npm run auth:secret`)
   - `NEXT_PUBLIC_APP_URL` (`https://<client-domain>`)
   - `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET` (optional — can also be entered in `/dashboard/settings`)
   - `RAZORPAY_WEBHOOK_SECRET` (if using Razorpay webhooks)
5. Connect the restaurant's custom domain in Railway Settings → Networking.

### Option B: Vercel + Supabase (Alternative per client)
1. Create a Supabase project for the restaurant and copy the Connection Pooler URL into `DATABASE_URL`.
2. Import the repository into the client's Vercel account and set the same environment variables above.

---

## 4. Razorpay Setup (Owner's Personal / Business Account)

1. Log in to the restaurant owner's Razorpay Dashboard → **Account & Settings → API Keys** and generate keys.
2. Either enter the **Key ID** and **Key Secret** directly in `/dashboard/settings` (under **Razorpay Merchant Keys**) or set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the hosting environment variables.
3. Optional Webhook for closed-browser safety:
   - In Razorpay Dashboard → **Webhooks**, add `https://<client-domain>/api/webhooks/razorpay`
   - Select event: `payment.captured`
   - Set a Webhook Secret and save it as `RAZORPAY_WEBHOOK_SECRET`.
4. Note: **Dine-in QR orders always default to Pay at Counter**, while **Delivery** and **Pickup** orders allow the customer to choose between **UPI / Card (Razorpay)** and **Cash on Delivery / Pay at Counter**.

---

## 5. Ownership Handover Checklist

- [ ] Verify `/menu`, `/checkout`, and `/t/[token]` (test QR link from `/dashboard/tables`)
- [ ] Log in to `/auth/login` and change the default owner password or create the owner's personal login in `/dashboard/staff`
- [ ] Confirm GST % in `/dashboard/settings` matches the restaurant's billing preference
- [ ] Print the table QR sheet from `/dashboard/tables` (`Print QR Sheet` button)
- [ ] Transfer the GitHub repo / Railway project ownership to the restaurant owner
