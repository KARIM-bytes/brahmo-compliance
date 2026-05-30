# BRAHMO Compliance Engine

![Supabase](https://img.shields.io/badge/Supabase-RLS%20Enforced-3ECF8E?style=flat&logo=supabase)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat&logo=typescript)
![Compliance](https://img.shields.io/badge/Audit-Tamper--Proof-red?style=flat)
![RLS](https://img.shields.io/badge/Access%20Control-Database%20Level-orange?style=flat)

> Database-enforced ethical walls, tamper-proof audit logging, and anonymized regulatory exports for legal firms.

Built for **Astroum AI Assessment 6** — a compliance infrastructure layer for the BRAHMO legal AI platform.

---

## What This Does

Legal firms using AI face a critical problem: an associate working on Client A's case must never see Client B's confidential matters — even accidentally. A bug in application code could leak data. BRAHMO solves this at the **database level**, not the application level.

Three core guarantees:

**1. Ethical Walls**
Matter-level data isolation enforced by Supabase Row Level Security. The database itself prevents unauthorized access. A bug in the API cannot leak data — RLS is the last line of defense.

**2. Tamper-Proof Audit Log**
Every blocked access attempt is recorded in an append-only log. `UPDATE` and `DELETE` are revoked at the PostgreSQL level. Even a database admin cannot silently modify the log. This is forensic-grade evidence.

**3. Compliance Export**
Every AI session recorded with who, when, which matter, SHA256 output hash (never full text — attorney-client privilege preserved), reviewer, and decision. Exportable as anonymized CSV for regulators.

---

## Try To Break It

These should all fail — by design:

```sql
-- Try to see TechCorp NDA as Priya (she has no permission)
SELECT * FROM matters WHERE id = 'matter_3';
→ Zero rows. Not an error. Matter doesn't exist for Priya.

-- Try to delete an audit log entry
DELETE FROM blocked_access_log WHERE id = 'block_001';
→ ERROR: blocked_access_log is append-only

-- Try to edit an audit log entry
UPDATE blocked_access_log SET reason = 'test' WHERE id = 'block_001';
→ ERROR: permission denied

-- Try to see Matter 2 as Sonia (same client as Matter 1, different matter)
SELECT * FROM matters WHERE id = 'matter_2'; -- queried as Sonia
→ Zero rows. Client-level access does not exist here.
```

---

## What The Regulator Gets

A CSV with:
- Anonymized client names (`Client A`, never `Rajesh Kumar`)
- SHA256 hashes, never full AI output text
- Every blocked access attempt included
- Complete review chain per session (start → end → reviewer → decision)
- Opens clean in Excel, no formatting issues

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database:** Supabase (PostgreSQL) with Row Level Security
- **Auth:** Demo user switcher (RLS context switching, no OAuth needed)
- **Export:** Server-side CSV generation with client anonymization

---

## Database Schema

```
users              → 4 users (Partner, Priya, Rahul, Sonia)
matters            → 4 matters across 3 clients
clients            → Client A, B, C
matter_permissions → who can access which matter (RLS source of truth)
ai_sessions        → every AI session: start, end, hash, review
blocked_access_log → append-only, tamper-proof denial log
```

---

## Permission Matrix

| User | Role | Matter 1 | Matter 2 | Matter 3 | Matter 4 |
|---|---|---|---|---|---|
| Priya Mehta | Associate | ✅ | ✅ | ❌ | ✅ |
| Rahul Singh | Associate | ❌ | ❌ | ✅ | ❌ |
| Sonia Das | Paralegal | ✅ | ❌ | ❌ | ❌ |
| Advocate Sharma | Partner | ✅ | ✅ | ✅ | ✅ |

---

## Local Setup

**1. Clone the repo**
```bash
git clone https://github.com/KARIM-bytes/brahmo-compliance.git
cd brahmo-compliance
```

**2. Install dependencies**
```bash
npm install
```

**3. Set up environment variables**
```bash
cp .env.local.example .env.local
```
Fill in your Supabase project URL and keys.

**4. Set up the database**
- Go to your Supabase project → SQL Editor
- Run `supabase/schema.sql` (creates tables + RLS policies + REVOKE)
- Run `supabase/seed.sql` (inserts test users, matters, sessions)

**5. Run the app**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

```bash
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

---

## Key Files

```
src/lib/ethical-wall.ts      ← checkAccess() + blocked_access_log INSERT
src/lib/audit-trail.ts       ← session recording + review chain
src/lib/compliance-export.ts ← CSV generation + client anonymization
supabase/schema.sql          ← ALL tables + RLS policies + REVOKE
docs/architecture.md         ← every design decision explained
```

---

## Innovations Built (Beyond Requirements)

**Hash-Chain Logging**
Each `blocked_access_log` entry includes SHA256 of the previous entry. Tampering is cryptographically detectable — missing or modified records break the chain. Forensic-grade logging.

**COLP Alert Tiers**
Compliance Officer for Legal Practice gets tiered alerts:
- 1-2 blocked events → INFO
- 3-4 events → WARNING
- 5+ events → CRITICAL + Escalate to COLP button

**Review SLA Tracking**
Sessions unreviewed past their SLA are flagged. Court filings: 24h. Client communications: 48h. Overdue sessions show red badge in partner dashboard.

**Permission Manager**
Partner-only UI showing full permission matrix across all users and matters. Grant/revoke with one click — RLS enforces instantly, including on all historical session data.

---

## Adding a New Associate

```sql
-- Step 1: Add them
INSERT INTO users (id, name, role, email)
VALUES ('new-uuid', 'Arjun Sharma', 'associate', 'arjun@firm.com');

-- Step 2: Give access to their matters
INSERT INTO matter_permissions (user_id, matter_id, permission_level)
VALUES
  ('new-uuid', 'matter_1', 'full'),
  ('new-uuid', 'matter_2', 'full');

-- Done. RLS enforces immediately.
-- No code changes. No restart. No cache invalidation.
-- Scales to 1000 associates and 10,000 matters identically.
```

---

## The Money Moment

> Priya queries Matter 3 (TechCorp NDA) → gets **zero rows**. Not an error. Not "access denied." The matter doesn't exist from her perspective. Meanwhile, `blocked_access_log` records the attempt silently in the background. Try `UPDATE blocked_access_log` in SQL editor → **permission denied**. That's the system working exactly as designed.
