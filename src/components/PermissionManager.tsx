'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/api-client';

interface Permission {
  user_id: string;
  matter_id: string;
  permission_level: string;
}

interface DynamicUser {
  id: string;
  name: string;
  role: string;
}

interface DynamicMatter {
  id: string;
  matter_name: string;
  practice_area: string | null;
}

interface PermissionManagerProps {
  currentPermissions: Permission[];
  onUpdate: () => void;
}

const areaColor: Record<string, string> = {
  criminal:  '#EF4444',
  property:  '#FACC15',
  corporate: '#A855F7',
  civil:     '#38BDF8',
};

export default function PermissionManager({ currentPermissions, onUpdate }: PermissionManagerProps) {
  const [users,   setUsers]   = useState<DynamicUser[]>([]);
  const [matters, setMatters] = useState<DynamicMatter[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [flash,   setFlash]   = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  // Fetch all users + matters from the permissions API (supabaseAdmin — bypasses RLS)
  useEffect(() => {
    authFetch('/api/permissions')
      .then((r) => r.json())
      .then((data: { users?: DynamicUser[]; matters?: DynamicMatter[] }) => {
        setUsers(data.users   ?? []);
        setMatters(data.matters ?? []);
      })
      .catch(console.error)
      .finally(() => setFetching(false));
  }, []);

  const hasPermission = (userId: string, matterId: string) =>
    currentPermissions.some((p) => p.user_id === userId && p.matter_id === matterId);

  async function toggle(userId: string, matterId: string) {
    const key = `${userId}_${matterId}`;
    setLoading(key);
    const granted = hasPermission(userId, matterId);

    const res = await authFetch('/api/permissions', {
      method: granted ? 'DELETE' : 'POST',
      body: JSON.stringify({ userId, matterId, permissionLevel: 'full' }),
    });

    const userName   = users.find((u) => u.id === userId)?.name    ?? userId.slice(0, 8);
    const matterName = matters.find((m) => m.id === matterId)?.matter_name ?? matterId;

    if (res.ok) {
      setFlash(granted
        ? `⊘ Revoked: ${userName} → ${matterName}`
        : `✓ Granted: ${userName} → ${matterName}`);
      setTimeout(() => setFlash(null), 3500);
      onUpdate();
    }
    setLoading(null);
  }

  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid rgba(0,255,159,0.2)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,.4)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(0,255,159,0.15)',
          background: 'rgba(0,255,159,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1rem' }}>⬡</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--accent)' }}>
              Permission Manager
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              Live from DB — new matters and users appear automatically
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: '.68rem', fontWeight: 600,
            padding: '3px 10px', borderRadius: '9999px',
            background: 'rgba(0,255,159,.1)', color: 'var(--accent)',
            border: '1px solid rgba(0,255,159,.25)',
          }}
        >
          PARTNER ONLY
        </span>
      </div>

      {/* Flash message */}
      {flash && (
        <div
          style={{
            padding: '10px 20px',
            fontSize: '.82rem', fontWeight: 600,
            background: flash.startsWith('⊘') ? 'rgba(239,68,68,.1)' : 'rgba(0,255,159,.1)',
            color: flash.startsWith('⊘') ? '#EF4444' : 'var(--accent)',
            borderBottom: `1px solid ${flash.startsWith('⊘') ? 'rgba(239,68,68,.2)' : 'rgba(0,255,159,.2)'}`,
          }}
        >
          {flash} — switch users to see RLS enforce the change live
        </div>
      )}

      {/* Loading */}
      {fetching ? (
        <div style={{ padding: '20px', fontSize: '.83rem', color: 'var(--text-muted)' }}>
          Loading users and matters from database…
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.83rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-hi)' }}>
                <th
                  style={{
                    padding: '12px 20px', textAlign: 'left',
                    fontSize: '.68rem', fontWeight: 600,
                    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  User ({users.length})
                </th>
                {matters.map((m) => (
                  <th
                    key={m.id}
                    style={{
                      padding: '12px 16px', textAlign: 'center',
                      fontSize: '.68rem', fontWeight: 600,
                      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em',
                      borderBottom: '1px solid var(--border)',
                      borderLeft: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ display: 'block', color: areaColor[m.practice_area ?? ''] ?? 'var(--text-second)' }}>
                      {m.matter_name.length > 22 ? m.matter_name.slice(0, 22) + '…' : m.matter_name}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '.62rem' }}>
                      {m.id}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: idx < users.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hi)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '.85rem' }}>
                      {user.name}
                    </div>
                    <div
                      style={{
                        fontSize: '.68rem', marginTop: '2px',
                        color: user.role === 'associate' ? '#A855F7' : '#FACC15',
                        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em',
                      }}
                    >
                      {user.role}
                    </div>
                  </td>
                  {matters.map((matter) => {
                    const key     = `${user.id}_${matter.id}`;
                    const granted = hasPermission(user.id, matter.id);
                    const busy    = loading === key;

                    return (
                      <td
                        key={matter.id}
                        style={{ padding: '14px 16px', textAlign: 'center', borderLeft: '1px solid var(--border)' }}
                      >
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => toggle(user.id, matter.id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '5px 14px', borderRadius: '9999px',
                            fontSize: '.72rem', fontWeight: 700,
                            cursor: busy ? 'not-allowed' : 'pointer',
                            border: 'none', transition: 'all .2s',
                            opacity: busy ? .5 : 1,
                            ...(granted
                              ? { background: 'rgba(0,255,159,.12)', color: 'var(--accent)', border: '1px solid rgba(0,255,159,.3)' }
                              : { background: 'rgba(113,113,122,.12)', color: 'var(--text-muted)', border: '1px solid var(--border)' }),
                          }}
                          onMouseEnter={(e) => {
                            if (busy) return;
                            const btn = e.currentTarget;
                            if (granted) {
                              btn.style.background = 'rgba(239,68,68,.12)';
                              btn.style.color = '#EF4444';
                              btn.style.border = '1px solid rgba(239,68,68,.3)';
                              btn.textContent = '✕ Revoke';
                            } else {
                              btn.style.background = 'rgba(0,255,159,.12)';
                              btn.style.color = 'var(--accent)';
                              btn.style.border = '1px solid rgba(0,255,159,.3)';
                              btn.textContent = '+ Grant';
                            }
                          }}
                          onMouseLeave={(e) => {
                            const btn = e.currentTarget;
                            if (granted) {
                              btn.style.background = 'rgba(0,255,159,.12)';
                              btn.style.color = 'var(--accent)';
                              btn.style.border = '1px solid rgba(0,255,159,.3)';
                              btn.textContent = '✓ Granted';
                            } else {
                              btn.style.background = 'rgba(113,113,122,.12)';
                              btn.style.color = 'var(--text-muted)';
                              btn.style.border = '1px solid var(--border)';
                              btn.textContent = '— None';
                            }
                          }}
                        >
                          {busy ? '…' : granted ? '✓ Granted' : '— None'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--border)',
          fontSize: '.72rem', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}
      >
        <span style={{ color: 'var(--accent)', fontSize: '.8rem' }}>⬡</span>
        {matters.length} matters · {users.length} users · All loaded live from DB — no hardcoded IDs
      </div>
    </section>
  );
}
