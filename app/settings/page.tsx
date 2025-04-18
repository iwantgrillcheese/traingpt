'use client';

import React, { useState } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    weeklyReminder: true,
    midweekCheckIn: false,
    raceCountdown: true,
  });

  const handleChange = (key: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }));
  };

  const handleSave = () => {
    // TODO: Send to backend or local storage
    alert('Settings saved!');
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="space-y-6 bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="flex items-center justify-between">
          <span className="text-lg font-medium">Weekly plan reminder email</span>
          <input
            type="checkbox"
            checked={settings.weeklyReminder}
            onChange={() => handleChange('weeklyReminder')}
            className="h-5 w-5 accent-orange-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-lg font-medium">Midweek check-in email</span>
          <input
            type="checkbox"
            checked={settings.midweekCheckIn}
            onChange={() => handleChange('midweekCheckIn')}
            className="h-5 w-5 accent-orange-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-lg font-medium">Race countdown reminders</span>
          <input
            type="checkbox"
            checked={settings.raceCountdown}
            onChange={() => handleChange('raceCountdown')}
            className="h-5 w-5 accent-orange-500"
          />
        </div>

        <div className="pt-4 text-right">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-orange-500 text-white font-medium rounded-full hover:bg-orange-600 transition"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
