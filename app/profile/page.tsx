'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ProfilePage() {
  const supabase = createClientComponentClient();
  const [profile, setProfile] = useState<{ name: string; email: string; avatar: string } | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.user) {
        console.error('Error fetching session:', error);
        return;
      }

      const { user_metadata, email } = session.user;
      setProfile({
        name: user_metadata?.full_name || 'Anonymous',
        email: email || '',
        avatar: user_metadata?.avatar_url || '',
      });
    };

    loadProfile();
  }, []);

  if (!profile) {
    return <div className="p-10">Loading profile...</div>;
  }

  return (
    <div className="max-w-md mx-auto p-8 bg-white rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-500 block mb-1">Name</label>
          <input value={profile.name} disabled className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1">Email</label>
          <input value={profile.email} disabled className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1">Experience Level</label>
          <select disabled className="w-full border rounded px-3 py-2 bg-gray-100">
            <option>Beginner</option>
          </select>
        </div>
      </div>
    </div>
  );
}
