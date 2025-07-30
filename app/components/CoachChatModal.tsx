'use client';

import { useState, useEffect } from 'react';
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
};

const SUGGESTED_QUESTIONS = [
  'How did I do this week?',
  'Will I be ready for my race?',
  'What should I focus on next week?',
  'What’s my biggest weakness?',
];

export default function CoachChatModal({ open, onClose }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [animatedResponse, setAnimatedResponse] = useState<string>('');

  const askCoach = async (question: string) => {
    setLoading(true);
    setInput('');
    setAnimatedResponse('');

    const updatedMessages: Message[] = [...messages, { role: 'user', content: question }];
    setMessages(updatedMessages);

    try {
      const res = await fetch('/api/coach-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
      });

      const data = await res.json();
      const reply = data.message || 'Sorry, I had trouble answering that.';

      // Animate response
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
      }, 15);
    } catch (err) {
      console.error('Coach chat failed:', err);
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: 'Something went wrong. Try again later.' },
      ]);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
        <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-zinc-900">
              💬 Ask Your Coach
            </Dialog.Title>
            <button onClick={onClose}>
              <XMarkIcon className="w-5 h-5 text-zinc-400 hover:text-zinc-600" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => askCoach(q)}
                className="rounded-full bg-zinc-100 hover:bg-zinc-200 text-sm text-zinc-700 px-4 py-1 transition"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="h-48 overflow-y-auto space-y-2 bg-zinc-50 p-3 rounded-lg text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={clsx(
                  'max-w-[80%] px-3 py-2 rounded-xl whitespace-pre-wrap',
                  m.role === 'user'
                    ? 'ml-auto bg-blue-600 text-white rounded-br-none'
                    : 'mr-auto bg-zinc-200 text-zinc-800 rounded-bl-none'
                )}
              >
                {m.content}
              </div>
            ))}

            {loading && animatedResponse && (
              <div className="max-w-[80%] px-3 py-2 rounded-xl bg-zinc-200 text-zinc-800 text-sm mr-auto rounded-bl-none whitespace-pre-wrap">
                {animatedResponse}
                <span className="animate-pulse">▍</span>
              </div>
            )}

            {loading && !animatedResponse && (
              <div className="text-sm text-zinc-500 italic">Coach is typing...</div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) askCoach(input.trim());
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              className="flex-1 rounded-full border border-zinc-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Ask
            </button>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
