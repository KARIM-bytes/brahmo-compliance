# BRAHMO Compliance Engine

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.local.example .env.local
```
Fill in:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### 3. Run schema in Supabase SQL Editor
Open `supabase/schema.sql` → paste into Supabase SQL Editor → Run

### 4. Create 4 Auth Users in Supabase Dashboard
Go to **Authentication → Users → Add User** for each:
```
sharma@firm.com  / Test1234!
priya@firm.com   / Test1234!
rahul@firm.com   / Test1234!
sonia@firm.com   / Test1234!
```

### 5. Sync UUIDs in seed.sql
After creating auth users, copy their UUIDs from the Auth panel.
Open `supabase/seed.sql` and replace:
```
SHARMA_UUID, PRIYA_UUID, RAHUL_UUID, SONIA_UUID
```
with the real UUIDs.

### 6. Run seed data
Open `supabase/seed.sql` → paste into SQL Editor → Run

### 7. Start the app
```bash
npm run dev
```
Open http://localhost:3000

---

## Demo Script (5 Steps)

**Step 1 — Normal Access**
Switch to Priya → Sessions tab
Expected: sees sessions for Matter 1 and Matter 2 only

**Step 2 — Ethical Wall Blocking**
As Priya → open browser console or Blocked Access tab (switch to Partner first)
POST `/api/access-check` with `{ matterId: 'matter_3' }`
Expected: `{ status: 'BLOCKED' }` + new row in `blocked_access_log`

**Step 3 — Isolation Proof (Sonia Test)**
Switch to Sonia → Sessions tab and Matters list
Expected: sees Matter 1 only — NOT Matter 2 (same client, different permission)

**Step 4 — Review Chain**
Switch to Partner → Review Queue tab
Find a pending session → add notes → click Approve
Expected: session `review_status` updates to `'reviewed'` in database

**Step 5 — Compliance Export**
As Partner → Export tab
Set date range → click Export Compliance CSV
Open downloaded file
Expected: client names show as `'Client A'`, `'Client B'` — no real names

---

## SQL Proofs for Evaluators

Run these in Supabase SQL Editor during the demo:

```sql
-- 1. Confirm RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables WHERE schemaname = 'public';

-- 2. Show active policies
SELECT policyname, tablename, cmd, qual
FROM pg_policies WHERE schemaname = 'public';

-- 3. Prove blocked_access_log is immutable (this must fail)
DELETE FROM blocked_access_log LIMIT 1;
-- Expected: ERROR: permission denied for table blocked_access_log

-- 4. Prove matter-level isolation
-- Log in as sonia@firm.com, then in SQL Editor with her session:
SELECT * FROM matters;
-- Returns: matter_1 only
```

---

## Innovation: Review SLA Tracker

Sessions pending review for more than 48 hours are flagged in red
on the Sessions dashboard. This reflects real compliance requirements
where AI output must be reviewed within a defined window.
