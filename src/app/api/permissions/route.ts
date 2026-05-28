import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedContext, requirePartner } from '@/lib/supabase';

// GET — fetch all matter_permissions, all matters, and all non-partner users (partner only, uses admin to bypass RLS)
export async function GET(req: NextRequest) {
  const context = await getAuthenticatedContext(req);
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requirePartner(context.profile)) {
    return NextResponse.json({ error: 'Partner role required' }, { status: 403 });
  }

  const [permsResult, mattersResult, usersResult] = await Promise.all([
    supabaseAdmin.from('matter_permissions').select('user_id, matter_id, permission_level, granted_by, granted_at'),
    supabaseAdmin.from('matters').select('id, matter_name, practice_area').order('id', { ascending: true }),
    supabaseAdmin.from('users').select('id, name, role').neq('role', 'partner').order('name', { ascending: true }),
  ]);

  if (permsResult.error) return NextResponse.json({ error: permsResult.error.message }, { status: 500 });
  if (mattersResult.error) return NextResponse.json({ error: mattersResult.error.message }, { status: 500 });
  if (usersResult.error) return NextResponse.json({ error: usersResult.error.message }, { status: 500 });

  return NextResponse.json({
    permissions: permsResult.data ?? [],
    matters:     mattersResult.data ?? [],
    users:       usersResult.data ?? [],
  });
}

// POST — grant a permission
export async function POST(req: NextRequest) {
  const context = await getAuthenticatedContext(req);
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requirePartner(context.profile)) {
    return NextResponse.json({ error: 'Partner role required' }, { status: 403 });
  }

  const body = (await req.json()) as {
    userId?: string;
    matterId?: string;
    permissionLevel?: string;
  };

  if (!body.userId || !body.matterId) {
    return NextResponse.json({ error: 'userId and matterId are required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('matter_permissions').insert({
    user_id: body.userId,
    matter_id: body.matterId,
    permission_level: body.permissionLevel ?? 'full',
    granted_by: context.authUser.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

// DELETE — revoke a permission
export async function DELETE(req: NextRequest) {
  const context = await getAuthenticatedContext(req);
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requirePartner(context.profile)) {
    return NextResponse.json({ error: 'Partner role required' }, { status: 403 });
  }

  const body = (await req.json()) as { userId?: string; matterId?: string };
  if (!body.userId || !body.matterId) {
    return NextResponse.json({ error: 'userId and matterId are required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('matter_permissions')
    .delete()
    .eq('user_id', body.userId)
    .eq('matter_id', body.matterId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
