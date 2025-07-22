// /app/coaching/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CoachingDashboard from '../components/CoachingDashboard'; // from page.tsx

export default function CoachingPage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClientComponentClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    fetchUser();
  }, []);

  if (!userId) return <p className="p-4">Loading...</p>;

  return <CoachingDashboard userId={userId} />;
}
