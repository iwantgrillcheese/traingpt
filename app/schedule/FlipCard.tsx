'use client';
import { useState } from 'react';
import clsx from 'clsx';

interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
}

export function FlipCard({ front, back }: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="relative w-full h-40 cursor-pointer perspective"
      onClick={() => setFlipped(!flipped)}
    >
      <div
        className={clsx(
          'absolute inset-0 transition-transform duration-500 ease-in-out transform-style-preserve-3d',
          flipped ? 'rotate-y-180' : ''
        )}
      >
        <div className="absolute inset-0 backface-hidden bg-white rounded-lg shadow-md p-4 flex items-center justify-center">
          {front}
        </div>
        <div className="absolute inset-0 backface-hidden bg-gray-50 rounded-lg shadow-md p-4 transform rotate-y-180 flex flex-col">
          {back}
        </div>
      </div>
    </div>
  );
}
