'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('kidtube_token');
    if (!token) {
      setError('Not logged in. Please log in from the dashboard.');
      setLoading(false);
      return;
    }
    // Fetch list of children first
    fetch('https://kidtube-almy.onrender.com/api/children', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject('Failed to load children'))
      .then(data => {
        setChildren(data);
        if (data.length > 0) {
          setSelectedChildId(data[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(e => {
        setError('Failed to load child profiles.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    const token = localStorage.getItem('kidtube_token');
    if (!token) return;
    setLoading(true);
    fetch(`https://kidtube-almy.onrender.com/api/history?childId=${selectedChildId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject('Failed to fetch history'))
      .then(data => {
        setHistory(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load watch history.');
        setLoading(false);
      });
  }, [selectedChildId]);

  return (
    <main className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-blue-600 dark:text-blue-400">Watch History &amp; Reports</h1>
            <p className="text-gray-500 dark:text-gray-400">See exactly what your child has been watching.</p>
          </div>
          <Link href="/" className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
            &larr; Back to Dashboard
          </Link>
        </header>

        {/* Child selector */}
        {children.length > 1 && (
          <div className="flex gap-3">
            {children.map((child: any) => (
              <button
                key={child.id}
                onClick={() => setSelectedChildId(child.id)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${selectedChildId === child.id ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300'}`}
              >
                {child.name}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
        )}

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading history logs...</div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No watch history available yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {history.map((item: any, idx: number) => (
                <div key={`${item.videoId}-${idx}`} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-32 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={`https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg line-clamp-1">{item.title}</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">{item.channelTitle}</p>
                      <p className="text-xs text-gray-400">
                        {item.timestamp ? new Date(item.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
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
