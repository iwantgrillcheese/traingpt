'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';

export default function ProfilePage() {
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
    return (
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-gray-500">Loading profile...</div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="max-w-lg mx-auto p-6 bg-white rounded-2xl shadow border border-gray-100">
        <h1 className="text-2xl font-bold mb-6">My Profile</h1>
        <div className="flex items-center gap-4 mb-6">
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt="Profile"
              className="w-16 h-16 rounded-full object-cover border border-gray-300"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200" />
          )}
          <div>
            <p className="font-medium text-lg">{profile.name}</p>
            <p className="text-gray-500 text-sm">{profile.email}</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-500 block mb-1">Name</label>
            <input
              value={profile.name}
              disabled
              className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-700"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1">Email</label>
            <input
              value={profile.email}
              disabled
              className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-700"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

