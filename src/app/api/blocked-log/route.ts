import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedContext, requirePartner } from '@/lib/supabase';
import type { BlockedAccessEvent } from '@/lib/types';

interface RawBlockedRow {
  event_id: string;
  user_id: string;
  attempted_matter_id: string;
  reason: string;
  details: string | null;
  timestamp: string;
  chain_hash: string | null;
  users: { name: string } | null;
}

export async function GET(req: NextRequest) {
  const context = await getAuthenticatedContext(req);
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requirePartner(context.profile)) {
    return NextResponse.json({ error: 'Partner role required' }, { status: 403 });
  }

  // Use supabaseAdmin to join user names — the user's client can't read other users' profiles
  const { data, error } = await supabaseAdmin
    .from('blocked_access_log')
    .select(`
      event_id,
      user_id,
      attempted_matter_id,
      reason,
      details,
      timestamp,
      chain_hash,
      users!blocked_access_log_user_id_fkey(name)
    `)
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('[blocked-log]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const events: BlockedAccessEvent[] = ((data ?? []) as RawBlockedRow[]).map((row) => ({
    event_id:             row.event_id,
    user_id:              row.user_id,
    user_name:            row.users?.name,
    attempted_matter_id:  row.attempted_matter_id,
    reason:               row.reason,
    details:              row.details,
    timestamp:            row.timestamp,
    chain_hash:           row.chain_hash,
  }));

  return NextResponse.json({ events });
}
