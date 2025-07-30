'use client';

import { useState } from 'react';
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
  'What’s my biggest weakness?',
  'How did I do this week?',
  'Will I be ready for my race?',
  'What should I focus on next week?',
];

export default function CoachChatModal({ open, onClose }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const askCoach = async (question: string) => {
    setLoading(true);
    setInput('');
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

      const assistantMessage: Message = { role: 'assistant', content: reply };
      setMessages([...updatedMessages, assistantMessage]);
    } catch (err) {
      console.error('Coach chat failed:', err);
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: 'Something went wrong. Try again later.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              💬 Ask Your Coach
            </Dialog.Title>
            <button onClick={onClose}>
              <XMarkIcon className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>

          <div className="space-y-2 mb-4">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => askCoach(q)}
                className="text-sm text-blue-600 underline hover:text-blue-800"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="h-48 overflow-y-auto space-y-3 bg-gray-50 p-3 rounded-md text-sm text-gray-800 mb-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={clsx(
                  'whitespace-pre-wrap',
                  m.role === 'user' ? 'text-right text-blue-700' : 'text-left text-gray-800'
                )}
              >
                {m.role === 'user' ? `You: ${m.content}` : `Coach: ${m.content}`}
              </div>
            ))}
            {loading && <div className="text-gray-500 italic">Coach is typing...</div>}
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
              className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Ask
            </button>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
