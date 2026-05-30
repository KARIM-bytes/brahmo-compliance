# BRAHMO Architecture Decisions

> Application code has bugs. Databases have RLS.
> We put the security where bugs can't reach it.

This document explains the **why** behind every major design decision in BRAHMO.

---

## What We Deliberately Did NOT Build

| Approach | Why We Rejected It |
|---|---|
| JWT middleware access checks | Bypassable if token is compromised or middleware has a bug |
| Frontend route guards | Meaningless — the API is still directly accessible |
| Application-level IF statements | One off-by-one error = client data leak |
| Error messages on denial | Reveals the matter exists — information leak |
| Full AI text in audit export | Breaches attorney-client privilege if handed to regulator |
| Single alert for all blocked events | Alert fatigue — 1 accident looks same as 5 attempts |

---

## Decision 1: RLS Over Application-Level Checks

**What we chose:** Supabase Row Level Security (PostgreSQL RLS policies)

**Why:**

```
❌ Application-level check (one bug = data leak):
   if (user.permissions.includes(matterId)) {
     return matter
   }

✅ Database-level RLS (bug-proof):
   USING (
     EXISTS (
       SELECT 1 FROM matter_permissions
       WHERE user_id = auth.uid()
       AND matter_id = matters.id
     )
   )
```

With RLS, even if someone **bypasses the API completely** and queries Supabase directly — the database returns zero rows for unauthorized matters. The security lives below the application layer where code bugs cannot reach it.

**How it scales:** The RLS policy has no hardcoded IDs. It checks `matter_permissions` dynamically on every single query. Adding 1000 new matters requires zero code changes — just INSERT into `matter_permissions`.

---

## Decision 2: REVOKE at PostgreSQL Level (Not Just RLS)

**What we chose:** `REVOKE UPDATE, DELETE ON blocked_access_log FROM authenticated`

**Why:**

RLS policies can be accidentally misconfigured by a future developer. A permissive UPDATE policy could undo the protection. `REVOKE` operates **below** RLS — it cannot be overridden by any policy change.

```sql
REVOKE UPDATE, DELETE ON blocked_access_log FROM authenticated;
REVOKE UPDATE, DELETE ON blocked_access_log FROM anon;
```

**The proof:** Go to Supabase SQL Editor (service_role key). Run:
```sql
UPDATE blocked_access_log SET reason = 'coverup' WHERE id = 'block_001';
```
Result: `ERROR: blocked_access_log is append-only`

This is what a regulator needs — not "difficult to tamper with" but **provably impossible**.

---

## Decision 3: Hash Chaining for Forensic Integrity

**What we chose:** SHA256 hash chain — each entry includes hash of previous entry

**Why:**

`REVOKE UPDATE/DELETE` prevents modifying records. But a malicious database admin could:
1. DROP the table
2. Recreate it
3. Re-insert filtered data (removing entries they want to hide)

Hash chaining defeats this completely:

```
block_001: chain_hash = SHA256(null + event_data_001)
block_002: chain_hash = SHA256(chain_hash_001 + event_data_002)
block_003: chain_hash = SHA256(chain_hash_002 + event_data_003)
```

Delete block_002 → block_003's hash no longer verifies → **tampering detected**.
Modify block_001 → every subsequent hash breaks → **tampering detected**.

This is forensic-grade logging. The chain cannot be silently manipulated.

---

## Decision 4: Zero Rows on Denial (Not Error Messages)

**What we chose:** Empty result set when access is denied

**What we rejected:** `"You don't have access to TechCorp NDA"`

**Why:**

That error message reveals:
1. TechCorp NDA exists as a matter in the system
2. The user is specifically denied (implying others have access)

In legal compliance, even the **existence** of a matter can be confidential. The ethical wall must make unauthorized matters completely invisible — as if they don't exist at all.

**Implementation:** RLS returns zero rows (not an error). The app shows nothing. The `blocked_access_log` records the attempt silently in the background. Priya never knows Matter 3 exists.

---

## Decision 5: SHA256 Hash, Not Full Output in Audit Trail

**What we chose:** `output_hash` (SHA256 of AI output) stored in `ai_sessions`

**What we rejected:** Full AI output text in the database

**Why:**

The compliance CSV is designed to be handed to regulators like the SRA. Full AI output text would expose confidential legal strategy — a direct breach of attorney-client privilege.

The hash serves two purposes:
1. **Privacy:** Regulator sees proof the session happened without seeing its content
2. **Integrity:** If output is ever disputed, the hash proves it wasn't modified after the session ended

---

## Decision 6: Client Anonymization in Export

**What we chose:** `Client A`, `Client B` in CSV (consistent mapping, never real names)

**Why:**

Regulators verify that the **compliance process** works — not which clients the firm represents. The client list itself is confidential. Consistent anonymization (Client A always maps to the same real client within an export) lets regulators verify patterns without seeing identities.

---

## Decision 7: COLP Alert Tiers

**What we chose:** Three-tier alert system

```
1-2 blocked events  → INFO     (log it, monitor)
3-4 blocked events  → WARNING  (compliance officer notified)
5+ blocked events   → CRITICAL (escalate to COLP immediately)
```

**Why:**

One blocked access event is probably an honest mistake — wrong matter selected. Five events from the same user in an hour is a pattern — potentially deliberate. A flat single alert creates noise. Tiered alerts mirror how real legal compliance systems work.

---

## Decision 8: Permission Manager (Partner-Only)

**What we chose:** Visual permission matrix UI for partners

**Why:**

Granting matter access via direct SQL requires database credentials — inappropriate for a managing partner. The Permission Manager wraps INSERT/DELETE on `matter_permissions` in a UI that only Partners can access.

**The key behaviour:** Revoking access is **instant**. The moment a `matter_permissions` row is deleted, RLS immediately hides all related matters AND all historical sessions for that matter. No cache to clear. No code to redeploy. Historical data protection is automatic.

---

## If The SRA Audited Us Tomorrow

1. Export CSV → anonymized, no real names, opens clean in Excel
2. Show `blocked_access_log` → tamper-proof, hash-chained, append-only
3. Show RLS policies in Supabase → database-enforced, not application code
4. Run `UPDATE blocked_access_log` in SQL editor → permission denied, live proof
5. Hand them the CSV → complete audit trail, reviewer names, decisions

**Time to produce: under 2 minutes.**

---

## Threat Model

| Threat | Mitigation |
|---|---|
| API bug passes wrong user_id | RLS enforces at DB level regardless of API |
| Associate tries to access rival client's matter | Zero rows returned, attempt logged silently |
| Someone tries to delete audit log entry | REVOKE prevents at PostgreSQL level |
| Admin tries to tamper with log | Hash chain detects missing or modified entries |
| Export reveals real client identities | Anonymization maps all names to Client A/B/C |
| AI output leaks privileged content | SHA256 hash stored, never full text |
| Repeated unauthorized access attempts | COLP alert tiers escalate automatically |
| New user needs access to matters | INSERT into matter_permissions, zero code changes |
| User leaves firm, access must be revoked | DELETE from matter_permissions, instant effect on all tables |

---

## Schema Summary

```sql
-- The single source of truth for all access control
matter_permissions (
  user_id          → references users(id)
  matter_id        → references matters(id)
  permission_level → 'full' | 'read'
  granted_by       → who granted this access
  granted_at       → when access was granted
)

-- RLS policy on matters table
CREATE POLICY "Users see permitted matters" ON matters
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM matter_permissions mp
    WHERE mp.user_id = auth.uid()
    AND mp.matter_id = matters.id
  )
);

-- Same pattern on ai_sessions
-- Historical sessions vanish the moment
-- matter_permissions row is deleted
```
