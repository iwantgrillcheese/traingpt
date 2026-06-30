'use client';

import { AuthProvider } from '@/lib/auth/AuthProvider';
import Layout from './components/Layout';
import PostHogIdentityBridge from './components/PostHogIdentityBridge';
import MagicUiObserverOverlay from '@/components/MagicUiObserverOverlay';
import PlanReadyReviewOverlay from '@/components/PlanReadyReviewOverlay';
import PlanGenerationFetchGuard from './components/PlanGenerationFetchGuard';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PostHogIdentityBridge />
      <PlanGenerationFetchGuard />
      <Layout>{children}</Layout>
      <MagicUiObserverOverlay />
      <PlanReadyReviewOverlay />
    </AuthProvider>
  );
}
