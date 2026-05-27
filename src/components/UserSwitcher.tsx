'use client';

// ============================================================
// components/UserSwitcher.tsx
//
// Demo user switcher — signs in via Supabase Auth using
// signInWithPassword so auth.uid() is a real JWT identity.
// Each switch: signOut current session, signIn as new user.
// This makes RLS policies using auth.uid() work natively.
// ============================================================

import { supabase } from '@/lib/supabase';
import type { User } from '@/lib/types';

// Demo accounts — passwords set during Supabase Auth setup (see README)
const DEMO_PASSWORD = 'Test1234!';

export const DEMO_USERS: User[] = [
  { id: 'user_partner', name: 'Advocate Sharma (Partner)', email: 'sharma@firm.com', role: 'partner',   sra_number: 'SRA-001', created_at: '' },
  { id: 'user_priya',   name: 'Priya Mehta (Associate)',   email: 'priya@firm.com',  role: 'associate', sra_number: 'SRA-002', created_at: '' },
  { id: 'user_rahul',   name: 'Rahul Singh (Associate)',   email: 'rahul@firm.com',  role: 'associate', sra_number: 'SRA-003', created_at: '' },
  { id: 'user_sonia',   name: 'Sonia Das (Paralegal)',     email: 'sonia@firm.com',  role: 'paralegal', sra_number: null,      created_at: '' },
];

interface UserSwitcherProps {
  currentUserId: string;
  onSwitch: (userId: string) => void;
}

export default function UserSwitcher({ currentUserId, onSwitch }: UserSwitcherProps) {
  const currentDemo = DEMO_USERS.find((u) => u.id === currentUserId);

  async function handleChange(email: string) {
    // 1. Sign out current session
    await supabase.auth.signOut();

    // 2. Sign in as selected demo user — this sets auth.uid() in every RLS check
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: DEMO_PASSWORD,
    });

    if (error || !data.user) {
      console.error('[UserSwitcher] signInWithPassword failed:', error?.message);
      return;
    }

    // 3. Notify parent with the real auth UUID so fetchData uses the right identity
    onSwitch(data.user.id);
  }

  return (
    <div className="user-switcher">
      <label htmlFor="user-select" className="user-switcher__label">
        👤 Demo User
      </label>
      <select
        id="user-select"
        value={currentDemo?.email ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        className="user-switcher__select"
      >
        {DEMO_USERS.map((u) => (
          <option key={u.id} value={u.email}>
            {u.name}
          </option>
        ))}
      </select>
      {currentDemo && (
        <span className={`user-switcher__badge user-switcher__badge--${currentDemo.role}`}>
          {currentDemo.role.toUpperCase()}
        </span>
      )}

      {/* Indicates demo credentials are in use */}
      <span className="user-switcher__demo-tag">⚠️ DEMO MODE</span>
    </div>
  );
}
