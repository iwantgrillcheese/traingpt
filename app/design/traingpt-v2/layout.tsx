import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TrainGPT 2.0 | Design Review',
  robots: { index: false, follow: false },
};

export default function DesignPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
