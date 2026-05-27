# BRAHMO Compliance Engine — Architecture

## 1. Why Row Level Security Over Application Checks

Application-level checks (e.g., `if (user.role === 'partner') return data`) can be bypassed by bugs in route handlers, missing middleware, or direct database access granted to a compromised service account. PostgreSQL RLS enforces access at the data layer — the policy runs inside the database engine on every query, regardless of how the query arrives. Even if all API code is deleted or bypassed, the database still returns zero rows for unauthorized queries. This means the security guarantee is not dependent on any application code being correct.

```sql
CREATE POLICY "matters_select" ON matters
  FOR SELECT USING (
    id IN (SELECT matter_id FROM matter_permissions WHERE user_id = auth.uid())
  );
```

---

## 2. Ethical Wall: How BLOCKED Access Works

When a user attempts to access a matter, `checkAccess()` in `src/lib/ethical-wall.ts` queries `matter_permissions` for the exact `(userId, matterId)` pair.

- If no matching row exists: access status is `BLOCKED`
- The blocked attempt is immediately logged to `blocked_access_log` with reason, user ID, and attempted matter ID
- The API route (`/api/access-check`) always returns HTTP **200** with `{ status: 'BLOCKED' }`
- It never returns **403** or **404**

Returning 403 or 404 would confirm to the requester that a matter exists (or does not) — leaking information across the ethical wall. By returning 200 with a generic `BLOCKED` status, the API gives no signal about whether the matter ID is valid, what client it belongs to, or why access was denied. This is called **security through obscurity at the API boundary**: the boundary itself reveals nothing.

---

## 3. Immutable Audit Log

The `blocked_access_log` table is made append-only at the PostgreSQL level by revoking modification privileges:

```sql
REVOKE UPDATE, DELETE ON blocked_access_log FROM authenticated;
REVOKE UPDATE, DELETE ON blocked_access_log FROM anon;
```

If anyone — including a database administrator using the anon or authenticated role — attempts to remove a record:

```sql
DELETE FROM blocked_access_log WHERE event_id = 'x';
-- ERROR: permission denied for table blocked_access_log
```

`INSERT` still works, so the logging mechanism continues to function. The result is a tamper-proof record: once an unauthorized access attempt is logged, it cannot be deleted or modified to cover tracks. Even a user who later gains elevated privileges cannot retroactively erase their blocked access history.

---

## 4. Audit Trail: Output Hash Not Full Text

`ai_sessions` stores `output_hash` (a SHA-256 digest of the AI output) rather than the full text of the AI response.

- **Why not store full output:** AI-generated legal drafts, research memos, and review notes may contain attorney-client privileged content. Storing them in a compliance log creates a secondary exposure risk.
- **What the hash provides:** A reviewer can take the AI output from the user's local environment, hash it, and compare it to `output_hash` in the database. If they match, the output was not tampered with after the session ended.
- **Regulatory use case:** If a regulator asks "was this AI output altered before submission?", the hash comparison answers the question definitively — without requiring access to the underlying privileged text.

---

## 5. Matter-Level Isolation (Sonia Test)

Client A has two active matters:

| Matter ID  | Matter Name                        |
|------------|------------------------------------|
| `matter_1` | Rajesh Kumar — Anticipatory Bail   |
| `matter_2` | Rajesh Kumar — Property Dispute    |

Sonia (paralegal) has a `matter_permissions` entry for `matter_1` only. She has no entry for `matter_2`, even though both matters belong to the same client.

When Sonia queries the database (via the RLS-enforced anon client):

```sql
SELECT * FROM matters;
-- Returns: only matter_1
-- matter_2 is invisible even though same client
```

This works because the RLS policy checks `matter_id` in `matter_permissions` — not `client_id`. There is no concept of "if you can see one matter for a client, you can see all their matters." Each matter is independently permissioned. This proves the system enforces **matter-level isolation**, not client-level isolation, which is the correct model for legal ethical walls.
