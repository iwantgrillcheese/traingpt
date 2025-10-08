'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Validating session...');

  useEffect(() => {
    const handleAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();

      console.log('OAuth callback user:', user);
      console.log('OAuth callback error:', error);

      if (error) {
        setStatus(`Auth error: ${error.message}`);
        return;
      }

      if (!user) {
        setStatus('No user returned. Please try signing in again.');
        return;
      }

      // ✅ Upsert into profiles table
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata.full_name,
        avatar_url: user.user_metadata.avatar_url,
      });

      if (upsertError) {
        console.error('Failed to upsert profile:', upsertError);
        setStatus('Login succeeded, but we couldn’t set up your profile.');
        return;
      }

      setStatus('Success! Redirecting...');
      router.push('/plan');
    };

    handleAuth();
  }, [router]);

  return (
    <div className="p-10 text-center">
      <p>{status}</p>
    </div>
  );
}
