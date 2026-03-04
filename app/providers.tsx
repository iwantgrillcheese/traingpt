'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import Layout from './components/Layout';
import PostHogIdentityBridge from './components/PostHogIdentityBridge';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [supabaseClient] = useState(() => createClientComponentClient());

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>
      <PostHogIdentityBridge supabaseClient={supabaseClient} />
      <Layout>{children}</Layout>
    </SessionContextProvider>
  );
}
