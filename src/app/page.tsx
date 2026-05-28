'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/api-client';
import type { User, AiSession, BlockedAccessEvent, DashboardStats, ReviewDecision, Matter, SessionWithJoins } from '@/lib/types';
import UserSwitcher from '@/components/UserSwitcher';
import SessionList from '@/components/SessionList';
import BlockedAccessLog from '@/components/BlockedAccessLog';
import ReviewPanel from '@/components/ReviewPanel';
import ExportButton from '@/components/ExportButton';
import StatsCards from '@/components/StatsCards';
import MatterList from '@/components/MatterList';
import PermissionManager from '@/components/PermissionManager';
import COLPAlerts from '@/components/COLPAlerts';

type TabKey = 'sessions' | 'blocked' | 'review' | 'export';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Request failed');
  }
  return response.json() as Promise<T>;
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionWithJoins[]>([]);
  const [pendingSessions, setPendingSessions] = useState<SessionWithJoins[]>([]);
  const [blockedEvents, setBlockedEvents] = useState<BlockedAccessEvent[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [allMatters, setAllMatters] = useState<Matter[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [permissions, setPermissions] = useState<{ user_id: string; matter_id: string; permission_level: string }[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('sessions');
  const [loading, setLoading] = useState(true);
  const [demoMatterId, setDemoMatterId] = useState('matter_1');
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const isPartner = currentUser?.role === 'partner';

  async function fetchData() {
    setLoading(true);
    setDemoMessage(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setCurrentUser(null);
        setSessions([]);
        setPendingSessions([]);
        setBlockedEvents([]);
        setMatters([]);
        setStats(null);
        return;
      }
      await supabase.auth.refreshSession();
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, name, email, role, sra_number, created_at')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('[fetchData] Profile query error:', profileError.message, profileError.code);
        throw new Error(`Profile query failed: ${profileError.message}`);
      }
      if (!profile) {
        console.error('[fetchData] No profile found for user:', authData.user.id);
        throw new Error('Profile not found in database');
      }

      const typedProfile = profile as User;
      setCurrentUser(typedProfile);

      const [mattersData, allMattersData, sessionsData, statsData] = await Promise.all([
        authFetch('/api/matters').then((r) => readJson<{ matters: Matter[] }>(r)),
        authFetch('/api/matters/all').then((r) => readJson<{ matters: Matter[] }>(r)),
        authFetch('/api/sessions').then((r) => readJson<{ sessions: AiSession[] }>(r)),
        authFetch('/api/stats').then((r) => readJson<{ stats: DashboardStats }>(r)),
      ]);

      setMatters(mattersData.matters);
      setAllMatters(allMattersData.matters);
      setSessions(sessionsData.sessions);
      setStats(statsData.stats);
      setNow(new Date().getTime());

      if (typedProfile.role === 'partner') {
        const [blockedData, reviewData, permsData] = await Promise.all([
          authFetch('/api/blocked-log').then((r) => readJson<{ events: BlockedAccessEvent[] }>(r)),
          authFetch('/api/review').then((r) => readJson<{ sessions: AiSession[] }>(r)),
          authFetch('/api/permissions').then((r) => readJson<{ permissions: { user_id: string; matter_id: string; permission_level: string }[]; matters: unknown[]; users: unknown[] }>(r)),
        ]);
        setBlockedEvents(blockedData.events);
        setPendingSessions(reviewData.sessions as SessionWithJoins[]);
        setPermissions(permsData.permissions);
      } else {
        setBlockedEvents([]);
        setPendingSessions([]);
        setPermissions([]);
      }
    } catch (error) {
      console.error('[dashboard]', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitch() { await fetchData(); }

  async function handleAccessDemo() {
    setDemoMessage(null);
    const access = await authFetch('/api/access-check', {
      method: 'POST',
      body: JSON.stringify({ matterId: demoMatterId }),
    }).then((r) => readJson<{ status: 'CLEAR' | 'BLOCKED' }>(r));

    if (access.status === 'BLOCKED') {
      setDemoMessage('BLOCKED: no matter details returned; event written to blocked_access_log.');
      await fetchData();
      return;
    }

    const created = await authFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ matterId: demoMatterId, queryType: 'research' }),
    }).then((r) => readJson<{ session?: { id: string }; sessions?: [] }>(r));

    setDemoMessage(
      created.session
        ? `CLEAR: session ${created.session.id} created and audit trail started.`
        : 'BLOCKED: session was not created.'
    );
    await fetchData();
  }

  async function handleReviewSubmit(sessionId: string, decision: ReviewDecision, notes: string): Promise<void> {
    await authFetch('/api/review', {
      method: 'POST',
      body: JSON.stringify({ sessionId, decision, notes }),
    }).then((r) => readJson<{ ok: boolean }>(r));
    await fetchData();
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchData(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
    { key: 'sessions', label: 'Sessions',      icon: '◈' },
    ...(isPartner
      ? [
          { key: 'blocked' as const, label: 'Blocked Access', icon: '⊘' },
          { key: 'review'  as const, label: 'Review Queue',   icon: '✦' },
          { key: 'export'  as const, label: 'Export',         icon: '↓' },
        ]
      : []),
  ];

  /* ── Landing / unauthenticated ─────────────────────────────── */
  if (!currentUser && !loading) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Logo mark */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '56px', height: '56px', borderRadius: '16px',
              background: 'var(--accent-dim)', border: '1px solid rgba(0,255,159,0.3)',
              fontSize: '1.5rem', marginBottom: '16px',
            }}>⬡</div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
              BRAHMO
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Compliance Engine
            </p>
          </div>

          <div className="grok-card" style={{ padding: '28px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 20px', fontSize: '0.875rem', color: 'var(--text-second)', lineHeight: 1.7 }}>
              Select a demo user to begin the secure RLS walkthrough.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <UserSwitcher currentUserId="" onSwitch={handleSwitch} />
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Ethical walls · Audit trails · Regulator-ready export
          </p>
        </div>
      </main>
    );
  }

  /* ── Main Dashboard ────────────────────────────────────────── */
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{
          maxWidth: '1280px', margin: '0 auto', height: '60px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--accent-dim)', border: '1px solid rgba(0,255,159,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', flexShrink: 0,
            }}>⬡</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                BRAHMO
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '-2px' }}>
                Compliance Engine
              </div>
            </div>
          </div>

          {/* Current user pill */}
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'var(--accent-dim)', border: '1px solid rgba(0,255,159,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)',
              }}>
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {currentUser.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {currentUser.role}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── User Switcher Bar ── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '12px 0' }}>
          <UserSwitcher
            currentUserId={currentUser?.id ?? ''}
            currentUserEmail={currentUser?.email}
            onSwitch={handleSwitch}
          />
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Stats */}
        <StatsCards stats={stats} loading={loading} />

        {/* Tabs */}
        <div style={{ marginTop: '28px', display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 16px',
                  fontSize: '0.82rem', fontWeight: active ? 600 : 500,
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  marginBottom: '-1px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-second)'; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab panels */}
        <div style={{ marginTop: '24px' }}>
          {activeTab === 'sessions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <MatterList matters={matters} loading={loading} />

              {/* Gap 1 — Dynamic Permission Manager (partner only) */}
              {isPartner && (
                <PermissionManager
                  currentPermissions={permissions}
                  onUpdate={fetchData}
                />
              )}

              {/* Live Access Check */}
              <div className="grok-card" style={{ padding: '20px' }}>
                <h2 style={{ margin: '0 0 4px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Live Access Check
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Simulate an AI session request against the ethical wall engine.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                  <select
                    value={demoMatterId}
                    onChange={(e) => setDemoMatterId(e.target.value)}
                    className="grok-select"
                  >
                    {/* Dynamically built from DB — new matters appear automatically */}
                    {allMatters.length > 0
                      ? allMatters.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id} / {m.matter_name}
                          </option>
                        ))
                      : <option value="">No matters in system</option>}
                  </select>
                  <button
                    type="button"
                    onClick={handleAccessDemo}
                    className="btn btn-primary"
                  >
                    Check Access &amp; Start Session
                  </button>
                </div>
                {demoMessage && (
                  <p style={{
                    marginTop: '12px', padding: '10px 14px',
                    borderRadius: '10px', fontSize: '0.82rem', fontWeight: 500,
                    background: demoMessage.startsWith('BLOCKED') ? 'var(--danger-dim)' : 'var(--accent-dim)',
                    color: demoMessage.startsWith('BLOCKED') ? 'var(--danger)' : 'var(--accent)',
                    border: `1px solid ${demoMessage.startsWith('BLOCKED') ? 'rgba(239,68,68,0.25)' : 'rgba(0,255,159,0.25)'}`,
                  }}>
                    {demoMessage}
                  </p>
                )}
              </div>

              <SessionList sessions={sessions} loading={loading} showReviewDetails={isPartner} now={now} />
            </div>
          )}

          {activeTab === 'blocked' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <COLPAlerts blockedEvents={blockedEvents} />
              <BlockedAccessLog events={blockedEvents} loading={loading} />
            </div>
          )}

          {activeTab === 'review' && (
            <ReviewPanel
              pendingSessions={pendingSessions}
              onReviewSubmit={handleReviewSubmit}
              loading={loading}
            />
          )}

          {activeTab === 'export' && <ExportButton />}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{
        marginTop: '48px',
        borderTop: '1px solid var(--border)',
        padding: '20px 24px',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
      }}>
        BRAHMO Compliance Engine · Ethical walls · Append-only audit · Regulator-ready export
      </footer>
    </main>
  );
}
