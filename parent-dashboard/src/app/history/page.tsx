'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Mock data representing what we'd fetch from Firestore `watch_history` subcollection
const MOCK_HISTORY = [
  {
    id: '1',
    videoId: 'jNQXAC9IVRw',
    title: 'Me at the zoo',
    channelTitle: 'jawed',
    watchedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    durationWatched: 18 // seconds
  },
  {
    id: '2',
    videoId: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up',
    channelTitle: 'Rick Astley',
    watchedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    durationWatched: 212 // seconds
  }
];

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching from Firestore
    setTimeout(() => {
      setHistory(MOCK_HISTORY);
      setLoading(false);
    }, 800);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-blue-600 dark:text-blue-400">Watch History & Reports</h1>
            <p className="text-gray-500 dark:text-gray-400">See exactly what your child has been watching.</p>
          </div>
          <Link href="/" className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
            &larr; Back to Dashboard
          </Link>
        </header>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading history logs...</div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No watch history available yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {history.map((item) => (
                <div key={item.id} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-32 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                      <img 
                        src={`https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`} 
                        alt="thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg line-clamp-1">{item.title}</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">{item.channelTitle}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(item.watchedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                      Watched: {formatDuration(item.durationWatched)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
