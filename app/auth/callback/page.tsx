'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AuthCallback() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [status, setStatus] = useState('Validating session...');

  useEffect(() => {
    const handleAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      console.log('OAuth callback session:', data);
      console.log('OAuth callback error:', error);

      if (error) {
        setStatus(`Auth error: ${error.message}`);
        return;
      }

      if (!data.session) {
        setStatus('No session returned. Please try signing in again.');
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
