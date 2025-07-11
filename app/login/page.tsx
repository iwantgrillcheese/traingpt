// app/login/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      // Check if the user already has a plan
      const { data: plan } = await supabase
        .from('plans')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (plan) {
        router.push('/schedule');
      } else {
        router.push('/plan');
      }
    };

    checkAndRedirect();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `https://traingpt.co/auth/callback`,
      },
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
      <h1 className="text-3xl font-semibold mb-6">Start Training Smarter</h1>
      <p className="text-gray-600 mb-6">Sign in with Google to generate your personalized training plan.</p>
      <button
        onClick={signInWithGoogle}
        className="bg-black text-white px-6 py-3 rounded-full hover:bg-gray-800 transition"
      >
        Start with Google
      </button>
    </div>
  );
}
