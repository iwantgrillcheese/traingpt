'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import Image from 'next/image';

export default function ProfileAvatar() {
  const [userData, setUserData] = useState<{ name: string; email: string; avatar: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return;

      const { user_metadata, email } = session.user;
      setUserData({
        name: user_metadata?.full_name || 'User',
        email: email || '',
        avatar: user_metadata?.avatar_url || 'https://i.pravatar.cc/40',
      });
    };

    getUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (!userData) return null;

  return (
    <div className="relative z-50">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="rounded-full border-2 border-transparent hover:border-gray-300 transition"
      >
        <Image
          src={userData.avatar}
          alt="Profile"
          width={36}
          height={36}
          className="rounded-full"
        />
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border z-50 text-left">
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium">{userData.name}</p>
            <p className="text-xs text-gray-500 truncate">{userData.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
