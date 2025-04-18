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
    return <div className="text-center py-20 text-gray-500">Loading profile...</div>;
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-semibold mb-8">My Profile</h1>

      <div className="bg-white border rounded-xl shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-4">
          <img
            src={profile.avatar}
            alt="Avatar"
            className="w-16 h-16 rounded-full border"
          />
          <div>
            <p className="text-lg font-semibold">{profile.name}</p>
            <p className="text-sm text-gray-500">{profile.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-500 block mb-1">Name</label>
            <input value={profile.name} disabled className="w-full border rounded px-3 py-2 bg-gray-50" />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1">Email</label>
            <input value={profile.email} disabled className="w-full border rounded px-3 py-2 bg-gray-50" />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1">Experience Level</label>
            <select disabled className="w-full border rounded px-3 py-2 bg-gray-100">
              <option>Intermediate</option>
            </select>
          </div>
        </div>
      </div>
    </main>
  );
}
