'use client';

import { useEffect, useRef, useState } from 'react';
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
  prefill?: string;
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
  const [animatedResponse, setAnimatedResponse] = useState('');
  const animationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAnimationTimer = () => {
    if (animationTimerRef.current) {
      clearInterval(animationTimerRef.current);
      animationTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearAnimationTimer();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      clearAnimationTimer();
      setAnimatedResponse('');
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !prefill) return;
    setInput(prefill);
  }, [open, prefill]);

  const askCoach = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;

    clearAnimationTimer();
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
          {
            role: 'assistant',
            content: data?.error || 'Something went wrong. Try again later.',
          },
        ]);
        setLoading(false);
        return;
      }

      const reply = (data?.message || 'Sorry, I had trouble answering that.').toString();

      let i = 0;
      const interval = setInterval(() => {
        setAnimatedResponse(reply.slice(0, i + 1));
        i += 1;

        if (i >= reply.length) {
          clearAnimationTimer();
          setMessages([...updatedMessages, { role: 'assistant', content: reply }]);
          setAnimatedResponse('');
          setLoading(false);
        }
      }, 10);

      animationTimerRef.current = interval;
    } catch {
      clearAnimationTimer();
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: 'Something went wrong. Try again later.' },
      ]);
      setAnimatedResponse('');
      setLoading(false);
    }
  };

  const clearChat = () => {
    if (loading) return;
    clearAnimationTimer();
    setMessages([]);
    setAnimatedResponse('');
    setInput(prefill ?? '');
  };

  const canSubmit = input.trim().length > 0 && !loading;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
        <Dialog.Panel className="w-full max-w-lg space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-zinc-900">
              Coach analysis
            </Dialog.Title>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={clearChat}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
                disabled={loading}
              >
                Clear
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
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
                type="button"
                onClick={() => askCoach(q)}
                disabled={loading}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="h-64 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
            <div className="space-y-2">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={clsx(
                    'max-w-[86%] rounded-2xl px-3 py-2 leading-relaxed whitespace-pre-wrap',
                    message.role === 'user'
                      ? 'ml-auto bg-zinc-900 text-white'
                      : 'mr-auto border border-zinc-200 bg-white text-zinc-900'
                  )}
                >
                  {message.content}
                </div>
              ))}

              {loading && animatedResponse ? (
                <div className="mr-auto max-w-[86%] rounded-2xl border border-zinc-200 bg-white px-3 py-2 whitespace-pre-wrap text-zinc-900">
                  {animatedResponse}
                  <span className="animate-pulse">▍</span>
                </div>
              ) : null}

              {loading && !animatedResponse ? (
                <div className="text-xs text-zinc-500 italic">Thinking…</div>
              ) : null}

              {messages.length === 0 && !loading ? (
                <div className="text-xs text-zinc-500">
                  Ask a specific question about your training, your progress, or what to do next.
                </div>
              ) : null}
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) askCoach(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your training…"
              className="flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none"
              disabled={loading}
            />

            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Ask
            </button>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
