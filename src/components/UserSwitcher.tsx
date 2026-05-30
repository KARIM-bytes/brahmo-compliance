'use client';

import { supabase } from '@/lib/supabase';
import type { User, UserRole } from '@/lib/types';

const DEMO_PASSWORD = 'Test1234!';

export const DEMO_USERS: Array<Pick<User, 'id' | 'name' | 'email' | 'role' | 'sra_number' | 'created_at'>> = [
  { id: 'a165eb17-a1ae-434c-88ae-8d970773b45f', name: 'Advocate Sharma', email: 'sharma@firm.com', role: 'partner',   sra_number: 'SRA-001', created_at: '' },
  { id: '335f7d86-f261-4d74-9b05-b84b88057279', name: 'Priya Mehta',     email: 'priya@firm.com',  role: 'associate', sra_number: 'SRA-002', created_at: '' },
  { id: 'dcc22e7e-c94f-4ee0-84bb-ac4cac063ed5', name: 'Rahul Singh',     email: 'rahul@firm.com',  role: 'associate', sra_number: 'SRA-003', created_at: '' },
  { id: 'ff1a4163-ca37-45de-9bf4-76e0d59ee128', name: 'Sonia Das',       email: 'sonia@firm.com',  role: 'paralegal', sra_number: null,      created_at: '' },
];

interface UserSwitcherProps {
  currentUserId: string;
  currentUserEmail?: string;
  onSwitch: (userId: string) => void;
}

const roleBadge: Record<UserRole, string> = {
  partner:   'badge badge-green',
  associate: 'badge badge-purple',
  paralegal: 'badge badge-amber',
};

export default function UserSwitcher({ currentUserId, currentUserEmail, onSwitch }: UserSwitcherProps) {
  const currentDemo = DEMO_USERS.find(
    (u) => u.id === currentUserId || u.email === currentUserEmail
  );

  async function handleChange(email: string) {
    await supabase.auth.signOut();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
    if (error || !data.user) {
      console.error('[UserSwitcher] sign-in failed:', error?.message);
      return;
    }
    // Brief yield — lets Supabase commit the new session to localStorage
    // before fetchData() calls getSession() inside authFetch.
    await new Promise((resolve) => setTimeout(resolve, 150));
    onSwitch(data.user.id);
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
      <label
        htmlFor="user-select"
        style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.02em' }}
      >
        DEMO USER
      </label>
      <select
        id="user-select"
        value={currentDemo?.email ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        className="grok-select"
      >
        <option value="" disabled>Select a user…</option>
        {DEMO_USERS.map((u) => (
          <option key={u.email} value={u.email}>
            {u.name} ({u.role})
          </option>
        ))}
      </select>
      {currentDemo && (
        <span className={roleBadge[currentDemo.role]}>
          {currentDemo.role.toUpperCase()}
        </span>
      )}
      <span className="badge badge-amber">DEMO MODE</span>
    </div>
  );
}
