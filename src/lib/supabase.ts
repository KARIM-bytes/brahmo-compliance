// ============================================================
// lib/supabase.ts — Supabase client factory
//
// We maintain TWO clients:
//   - anonClient  → respects RLS (used for all user-facing queries)
//   - adminClient → service_role key (used ONLY for BLOCKED_ACCESS
//                   INSERT and compliance export that needs full view)
//
// ⚠️  adminClient bypasses RLS — never expose it to the browser.
//     Keep it server-side (Next.js API routes) only.
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix — undefined in browser.
// API routes get the real value; browser bundle gets the anon key as a safe fallback.
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY;

// ── Public (anon) client — browser-safe, RLS enforced ───────
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ── Admin client — SERVER-SIDE ONLY, bypasses RLS ────────────
// In API routes: uses real service_role key.
// In browser bundle: falls back to anon key (harmless — never called client-side).
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);


export interface AuthContext {
  client:   SupabaseClient;
  authUser: { id: string; email?: string };
  profile:  { id: string; name: string; email: string; role: string; sra_number: string | null };
}

/**
 * getAuthenticatedContext — used by all API routes.
 *
 * 1. Reads the Bearer token from Authorization header
 * 2. Verifies it against Supabase Auth → gets authUser
 * 3. Looks up the public.users profile row → gets role/name
 * 4. Returns an RLS-scoped client where auth.uid() = user.id
 *
 * Returns null → route responds 401.
 */
export async function getAuthenticatedContext(req: NextRequest): Promise<AuthContext | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  // Verify token with Supabase Auth
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  // Look up profile in public.users (use admin to bypass RLS for this lookup)
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, name, email, role, sra_number')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  // Build RLS-scoped client: every downstream query runs as auth.uid() = user.id
  const scopedClient: SupabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  return {
    client:   scopedClient,
    authUser: { id: user.id, email: user.email },
    profile:  profile as AuthContext['profile'],
  };
}

/**
 * requirePartner — call after getAuthenticatedContext to gate partner-only routes.
 * Returns true if the user has the 'partner' role, false otherwise.
 */
export function requirePartner(profile: AuthContext['profile'] | null | undefined): boolean {
  return profile?.role === 'partner';
}
