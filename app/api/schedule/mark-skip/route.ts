import { setSessionCompletion } from '@/lib/setSessionCompletion';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) { return setSessionCompletion(req, 'skipped'); }
