import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedContext } from '@/lib/supabase';

// GET — returns ALL matters regardless of the caller's permissions.
// Used ONLY by the Live Access Check dropdown so users can attempt
// to access matters they don't have permission to (ethical wall demo).
// The actual access control happens in /api/access-check → checkAccess().
export async function GET(req: NextRequest) {
  const context = await getAuthenticatedContext(req);
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('matters')
    .select('id, matter_name, practice_area, client_id')
    .order('id', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ matters: data ?? [] });
}
