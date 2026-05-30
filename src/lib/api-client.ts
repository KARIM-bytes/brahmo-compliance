'use client';

import { supabase } from './supabase';

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  // getSession() reads from storage (fast). After a user switch, the new token
  // may not have propagated yet — fall back to refreshSession() to guarantee freshness.
  let { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) {
    const refreshed = await supabase.auth.refreshSession();
    data = refreshed.data;
  }

  const token = data.session?.access_token;
  const headers = new Headers(init.headers);

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(input, { ...init, headers });
}
