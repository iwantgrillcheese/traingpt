'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';

const quotes = [
  "Don't count the days, make the days count.",
  "Discipline is doing it when you don’t feel like it.",
  "You do not rise to the level of your goals. You fall to the level of your systems.",
  "Train hard, race easy.",
  "Success is peace of mind that is the direct result of self-satisfaction in knowing you did your best to become the best that you are capable of becoming",
  "Little by little, a little becomes a lot.",
  "The only bad workout is the one you didn’t do."
];

type FieldConfig = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  options?: string[];
  placeholder?: string;
};

export default function Home() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    raceType: '',
    raceDate: '',
    bikeFTP: '',
    runPace: '',
    swimPace: '',
    experience: '',
    maxHours: '',
    restDay: '',
  });
  const [userNote, setUserNote] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    localStorage.setItem('trainGPTPlanRequest', JSON.stringify({ ...formData, userNote }));
    router.push('/schedule');
  };

  const beginnerFields: FieldConfig[] = [
    { id: 'raceType', label: 'Race Type', type: 'select', options: ['Half Ironman (70.3)', 'Ironman (140.6)', 'Olympic', 'Sprint'] },
    { id: 'raceDate', label: 'Race Date', type: 'date' },
    { id: 'maxHours', label: 'Max Weekly Training Hours', type: 'number' },
    { id: 'experience', label: 'Experience Level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] }
  ];

  const advancedFields: FieldConfig[] = [
    { id: 'bikeFTP', label: 'Bike FTP (watts)', type: 'number' },
    { id: 'runPace', label: 'Run Threshold Pace (min/mi)', type: 'text', placeholder: 'e.g. 7:30' },
    { id: 'swimPace', label: 'Swim Threshold Pace (per 100m)', type: 'text', placeholder: 'e.g. 1:38' },
    { id: 'restDay', label: 'Preferred Rest Day', type: 'select', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold tracking-tight">Generate Your Plan</h1>
          <p className="mt-3 text-gray-500 text-lg">We’ll personalize your training based on your inputs.</p>
        </div>

        <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="bg-gray-50 border border-gray-200 shadow-sm rounded-xl p-8 grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {[...beginnerFields, ...(showAdvanced ? advancedFields : [])].map(({ id, label, type, options, placeholder }) => (
            <div key={id}>
              <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              {type === 'select' ? (
                <select
                  id={id}
                  name={id}
                  value={formData[id as keyof typeof formData]}
                  onChange={handleChange}
                  className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
                >
                  <option value="">Select...</option>
                  {options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  type={type}
                  id={id}
                  name={id}
                  placeholder={placeholder}
                  value={formData[id as keyof typeof formData]}
                  onChange={handleChange}
                  className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
                />
              )}
            </div>
          ))}

          <div className="md:col-span-2">
            <label htmlFor="userNote" className="block text-sm font-medium text-gray-700 mb-1">Customize your plan (optional)</label>
            <textarea
              id="userNote"
              name="userNote"
              rows={3}
              placeholder="E.g. I’m targeting a 1:30 half marathon off the bike and need help with swim fitness..."
              value={userNote}
              onChange={e => setUserNote(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-center space-x-3 mt-2">
            <span className="text-sm text-gray-600">Advanced Options</span>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showAdvanced ? 'bg-black' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showAdvanced ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="md:col-span-2 text-center mt-4">
            <button
              type="submit"
              className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800"
            >
              Generate Plan
            </button>
          </div>
        </form>
      </main>

      <div className="max-w-screen-xl mx-auto px-6">
        <BlogPreview />
      </div>

      <Footer />
    </div>
  );
}
