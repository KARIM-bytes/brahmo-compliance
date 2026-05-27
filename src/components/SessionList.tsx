'use client';

// ============================================================
// components/SessionList.tsx
//
// Shows recent AI sessions for the current user.
// Each row: date | user | matter | type | review status
// Pending sessions show a clock icon. Reviewed show ✅ or ❌.
// ============================================================

import { AiSession } from '@/lib/types';

interface SessionListProps {
  sessions: AiSession[];
  loading: boolean;
  /** If true, show reviewer name + decision (partner view) */
  showReviewDetails?: boolean;
}

export default function SessionList({
  sessions,
  loading,
  showReviewDetails = false,
}: SessionListProps) {
  if (loading) {
    return <div className="session-list session-list--loading">Loading sessions…</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="session-list session-list--empty">
        No sessions found for your permitted matters.
      </div>
    );
  }

  const SLA_HOURS = 48;

  function isSlaBreached(session: AiSession): boolean {
    if (session.review_status !== 'pending') return false;
    const started = new Date(session.session_start).getTime();
    const hoursElapsed = (Date.now() - started) / (1000 * 60 * 60);
    return hoursElapsed > SLA_HOURS;
  }

  return (
    <div className="session-list">
      <table className="session-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>User</th>
            <th>Matter</th>
            <th>Type</th>
            <th>Output Hash</th>
            <th>Status</th>
            {showReviewDetails && <th>Reviewer / Decision</th>}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const sla = isSlaBreached(s);
            return (
              <tr
                key={s.id}
                className={`session-row session-row--${s.review_status}${sla ? ' session-row--sla-breach' : ''}`}
              >
                <td>{new Date(s.session_start).toLocaleDateString()}</td>
                <td>{s.user_id}</td>
                <td>{s.matter_id}</td>
                <td>
                  <span className={`badge badge--${s.query_type}`}>
                    {s.query_type}
                  </span>
                </td>
                <td className="session-row__hash">
                  <code>{s.output_hash?.slice(0, 12) ?? '—'}…</code>
                </td>
                <td>
                  <StatusBadge status={s.review_status} />
                  {sla && (
                    <span className="sla-badge" title="Pending review for more than 48 hours">
                      ⚠️ SLA BREACH
                    </span>
                  )}
                </td>
                {showReviewDetails && (
                  <td>
                    {s.reviewer_id ? (
                      <>
                        <strong>{s.reviewer_id}</strong> — {s.review_decision}
                        {s.review_notes && (
                          <p className="session-row__notes">{s.review_notes}</p>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: string; label: string }> = {
    reviewed: { icon: '✅', label: 'Reviewed' },
    pending:  { icon: '⏳', label: 'Pending' },
    rejected: { icon: '❌', label: 'Rejected' },
  };
  const { icon, label } = map[status] ?? { icon: '❓', label: status };
  return (
    <span className={`status-badge status-badge--${status}`}>
      {icon} {label}
    </span>
  );
}
