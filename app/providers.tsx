'use client';

import { AuthProvider } from '@/lib/auth/AuthProvider';
import Layout from './components/Layout';
import PostHogIdentityBridge from './components/PostHogIdentityBridge';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PostHogIdentityBridge />
      <Layout>{children}</Layout>
    </AuthProvider>
  );
}