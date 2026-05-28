'use client';

import type { BlockedAccessEvent } from '@/lib/types';

interface BlockedAccessLogProps {
  events: BlockedAccessEvent[];
  loading: boolean;
}

export default function BlockedAccessLog({ events, loading }: BlockedAccessLogProps) {
  if (loading) {
    return (
      <div className="grok-card p-6" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="dot-live" /> Loading blocked events…
        </div>
      </div>
    );
  }

  return (
    <section className="grok-card" style={{ overflow: 'hidden', borderColor: 'rgba(239,68,68,0.25)' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(239,68,68,0.2)',
        background: 'rgba(239,68,68,0.05)',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        justifyContent: 'space-between', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1rem' }}>⊘</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#F87171' }}>
              Blocked Access Log
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Each entry is hash-chained — tampering is cryptographically detectable
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge badge-red">Append-only · Immutable</span>
          <span style={{
            fontSize: '.68rem', fontWeight: 600, padding: '2px 8px',
            borderRadius: '9999px', background: 'rgba(239,68,68,.08)',
            color: '#F87171', border: '1px solid rgba(239,68,68,.2)',
          }}>
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Immutability proof banner */}
      <div style={{
        padding: '8px 20px',
        borderBottom: '1px solid rgba(239,68,68,0.1)',
        fontSize: '.72rem', color: 'var(--text-muted)',
        fontFamily: '"JetBrains Mono", monospace',
        background: 'rgba(0,0,0,.2)',
      }}>
        <span style={{ color: '#EF4444' }}>SQL proof:</span>{' '}
        <span style={{ color: 'var(--text-second)' }}>
          DELETE FROM blocked_access_log WHERE event_id = &apos;block_001&apos;;
        </span>{' '}
        <span style={{ color: 'var(--accent)' }}>→ ERROR: blocked_access_log is append-only</span>
      </div>

      {events.length === 0 ? (
        <div style={{ padding: '24px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          No blocked events recorded yet. Trigger an access attempt using the Live Access Check.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="grok-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Attempted Matter</th>
                <th>Reason</th>
                <th>Chain Hash</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.event_id}>
                  <td style={{ color: 'var(--text-primary)', fontSize: '.8rem' }}>
                    {new Date(event.timestamp).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                    })}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '.83rem', color: 'var(--text-primary)' }}>
                      {event.user_name ?? '—'}
                    </div>
                    <div className="font-mono" style={{ fontSize: '.65rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {event.user_id.slice(0, 12)}…
                    </div>
                  </td>
                  <td className="font-mono" style={{ fontSize: '0.78rem', color: '#F87171', fontWeight: 600 }}>
                    {event.attempted_matter_id}
                  </td>
                  <td>
                    <span className="badge badge-red">{event.reason}</span>
                  </td>
                  <td>
                    {event.chain_hash ? (
                      <span
                        className="font-mono"
                        style={{ fontSize: '.65rem', color: 'var(--accent)', opacity: 0.7 }}
                        title={event.chain_hash}
                      >
                        {event.chain_hash.slice(0, 16)}…
                      </span>
                    ) : (
                      <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
