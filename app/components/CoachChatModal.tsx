'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  prefill?: string; // NEW
};

const SUGGESTED_QUESTIONS = [
  'What should I focus on next?',
  'Why did my fitness stall?',
  'Am I training consistently?',
  'How should I structure the next 2 weeks?',
];

export default function CoachChatModal({ open, onClose, prefill }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [animatedResponse, setAnimatedResponse] = useState<string>('');

  // Prefill behavior: populate input when opened (don’t auto-send)
  useEffect(() => {
    if (!open) return;
    if (!prefill) return;
    setInput(prefill);
  }, [open, prefill]);

  const askCoach = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setInput('');
    setAnimatedResponse('');

    const updatedMessages: Message[] = [...messages, { role: 'user', content: q }];
    setMessages(updatedMessages);

    try {
      const res = await fetch('/api/coach-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          history: updatedMessages.slice(-12),
        }),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setMessages([
          ...updatedMessages,
          { role: 'assistant', content: data?.error || 'Something went wrong. Try again later.' },
        ]);
        setLoading(false);
        return;
      }

      const reply = (data?.message || 'Sorry, I had trouble answering that.').toString();

      let i = 0;
      const interval = setInterval(() => {
        setAnimatedResponse(reply.slice(0, i + 1));
        i++;
        if (i >= reply.length) {
          clearInterval(interval);
          setMessages([...updatedMessages, { role: 'assistant', content: reply }]);
          setAnimatedResponse('');
          setLoading(false);
        }
      }, 10);
    } catch (err) {
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: 'Something went wrong. Try again later.' },
      ]);
      setLoading(false);
    }
  };

  const clearChat = () => {
    if (loading) return;
    setMessages([]);
    setAnimatedResponse('');
    setInput(prefill ?? '');
  };

  const canSubmit = input.trim().length > 0 && !loading;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
        <Dialog.Panel className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              Coach analysis
            </Dialog.Title>

            <div className="flex items-center gap-3">
              <button
                onClick={clearChat}
                className="text-xs font-medium text-gray-500 hover:text-gray-900"
                disabled={loading}
              >
                Clear
              </button>
              <button
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => askCoach(q)}
                disabled={loading}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="h-64 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
            <div className="space-y-2">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={clsx(
                    'max-w-[86%] px-3 py-2 rounded-2xl whitespace-pre-wrap leading-relaxed',
                    m.role === 'user'
                      ? 'ml-auto bg-gray-900 text-white'
                      : 'mr-auto bg-white text-gray-900 border border-gray-200'
                  )}
                >
                  {m.content}
                </div>
              ))}

              {loading && animatedResponse ? (
                <div className="max-w-[86%] px-3 py-2 rounded-2xl bg-white text-gray-900 border border-gray-200 mr-auto whitespace-pre-wrap">
                  {animatedResponse}
                  <span className="animate-pulse">▍</span>
                </div>
              ) : null}

              {loading && !animatedResponse ? (
                <div className="text-xs text-gray-500 italic">Thinking…</div>
              ) : null}

              {messages.length === 0 && !loading ? (
                <div className="text-xs text-gray-500">
                  Ask a specific question about your training, your progress, or what to do next.
                </div>
              ) : null}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) askCoach(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your training…"
              className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Ask
            </button>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
