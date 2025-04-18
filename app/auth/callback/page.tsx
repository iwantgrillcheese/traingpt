'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AuthCallback() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      // This ensures the session cookie is set after Google OAuth redirect
      const { error } = await supabase.auth.getSession();
      if (error) {
        console.error('Auth callback error:', error);
      }
      router.push('/plan');
    };
    handleAuth();
  }, [router]);

  return <p className="p-10 text-center">Signing in...</p>;
}
