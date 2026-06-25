'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

interface Child {
  id: string;
  name: string;
  stars: number;
  dailyLimitMins: number;
  bedtime: string;
  hiddenVideos: string[];
}

interface Channel {
  id: string;
  channelId: string;
  channelTitle: string;
}

interface Video {
  id: string;
  videoId: string;
  title: string;
  channelId: string;
  thumbnails?: { medium?: { url: string }; high?: { url: string } };
  isHidden: boolean;
}

interface HistoryItem {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  timestamp: string;
}

type Message = { text: string; type: 'success' | 'error' | 'info' | ''; onUndo?: () => void };

export default function Home() {
  // ─── Auth ─────────────────────────────────────────────────────────────────
  const [userEmail, setUserEmail] = useState('');

  // ─── Global Settings ──────────────────────────────────────────────────────
  const [disableShorts, setDisableShorts] = useState(true);
  const [educationalTollbooth, setEducationalTollbooth] = useState(false);
  const [devicePassword, setDevicePassword] = useState('');
  const [devicePasswordMsg, setDevicePasswordMsg] = useState<Message>({ text: '', type: '' });

  // ─── Children ─────────────────────────────────────────────────────────────
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [newChildName, setNewChildName] = useState('');
  const [loadingChild, setLoadingChild] = useState(false);

  // ─── Child Dashboard ──────────────────────────────────────────────────────
  const [channels, setChannels] = useState<Channel[]>([]);
  const [watchHistory, setWatchHistory] = useState<HistoryItem[]>([]);
  const [newChannel, setNewChannel] = useState('');
  const [loadingChannel, setLoadingChannel] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [message, setMessage] = useState<Message>({ text: '', type: '' });

  // ─── Child Settings ───────────────────────────────────────────────────────
  const [dailyLimitMins, setDailyLimitMins] = useState(60);
  const [bedtime, setBedtime] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // ─── Video Management ─────────────────────────────────────────────────────
  const [managingChannelId, setManagingChannelId] = useState<string | null>(null);
  const [channelVideos, setChannelVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  const router = useRouter();

  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showMessage = (text: string, type: Message['type'], duration = 3000, onUndo?: () => void) => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    setMessage({ text, type, onUndo });
    messageTimeoutRef.current = setTimeout(() => setMessage({ text: '', type: '' }), duration);
  };

  // ─── Initial Load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const tk = localStorage.getItem('kidtube_token');
    const email = localStorage.getItem('kidtube_userId');
    if (!tk) { router.push('/login'); return; }
    if (email) setUserEmail(email);

    Promise.all([api.settings.get(), api.children.list()])
      .then(([settings, kids]) => {
        setDisableShorts(settings.disableShorts ?? true);
        setEducationalTollbooth(settings.educationalTollbooth ?? false);
        setChildren(kids);
      })
      .catch(console.error);
  }, [router]);

  // ─── Child-Specific Data ──────────────────────────────────────────────────
  const fetchChildData = useCallback((child: Child) => {
    setDailyLimitMins(child.dailyLimitMins ?? 60);
    setBedtime(child.bedtime ?? '');

    api.channels.list(child.id)
      .then(setChannels)
      .catch(() => setChannels([]));

    setLoadingHistory(true);
    api.history.list(child.id)
      .then(setWatchHistory)
      .catch(() => setWatchHistory([]))
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    if (selectedChild) fetchChildData(selectedChild);
  }, [selectedChild, fetchChildData]);

  // ─── Action: Logout ───────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem('kidtube_token');
    localStorage.removeItem('kidtube_userId');
    router.push('/login');
  };

  // ─── Action: Create Child ─────────────────────────────────────────────────
  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildName.trim()) return;
    setLoadingChild(true);
    try {
      await api.children.create(newChildName.trim());
      setNewChildName('');
      const kids = await api.children.list();
      setChildren(kids);
    } catch (err: any) {
      showMessage(err.message || 'Failed to create profile.', 'error');
    } finally {
      setLoadingChild(false);
    }
  };

  // ─── Action: Delete Child ─────────────────────────────────────────────────
  const handleDeleteChild = async (e: React.MouseEvent, childId: string) => {
    e.stopPropagation(); // prevent opening the child dashboard
    if (!confirm('Are you sure you want to delete this profile? This cannot be undone.')) return;
    
    try {
      await api.children.delete(childId);
      setChildren(prev => prev.filter(c => c.id !== childId));
      if (selectedChild?.id === childId) {
        setSelectedChild(null);
      }
      showMessage('Profile deleted.', 'success');
    } catch (err: any) {
      showMessage(err.message || 'Failed to delete profile.', 'error');
    }
  };

  // ─── Action: Save Child Settings ──────────────────────────────────────────
  const handleUpdateChildSettings = async () => {
    if (!selectedChild) return;
    setSavingSettings(true);
    try {
      await api.children.updateSettings(selectedChild.id, { dailyLimitMins, bedtime });
      const updated = { ...selectedChild, dailyLimitMins, bedtime };
      setSelectedChild(updated);
      setChildren((prev) => prev.map((c) => (c.id === selectedChild.id ? updated : c)));
      showMessage('Settings saved!', 'success');
    } catch (err: any) {
      showMessage(err.message || 'Failed to save settings.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // ─── Action: Update Global Setting ───────────────────────────────────────
  const updateGlobalSetting = async (key: string, value: boolean) => {
    try {
      await api.settings.update({ [key]: value });
    } catch (err) {
      console.error(`Failed to update ${key}:`, err);
    }
  };

  // ─── Action: Set Device Password ──────────────────────────────────────────
  const handleSetDevicePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevicePasswordMsg({ text: 'Saving...', type: 'info' });
    try {
      await api.auth.setDevicePassword(devicePassword);
      setDevicePassword('');
      setDevicePasswordMsg({ text: 'Password updated! Use this to log into the child app.', type: 'success' });
    } catch (err: any) {
      setDevicePasswordMsg({ text: err.message || 'Failed to set password.', type: 'error' });
    }
  };

  // ─── Action: Add Channel ──────────────────────────────────────────────────
  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannel || !selectedChild) return;
    
    const channelToAdd = newChannel;
    setNewChannel('');
    showMessage(`Analyzing ${channelToAdd} with AI...`, 'info', 60000);
    
    try {
      const data = await api.channels.add(channelToAdd, selectedChild.id) as { message?: string };
      showMessage(data.message || `Channel ${channelToAdd} added!`, 'success');
      const updated = await api.channels.list(selectedChild.id);
      setChannels(updated);
    } catch (err: any) {
      showMessage(err.message || `Failed to add ${channelToAdd}.`, 'error');
    }
  };

  // ─── Action: Remove Channel ───────────────────────────────────────────────
  const removeTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const handleRemoveChannel = (channel: Channel) => {
    if (!selectedChild) return;

    // Optimistic removal
    setChannels((prev) => prev.filter((c) => c.id !== channel.id));

    const timeout = setTimeout(async () => {
      try {
        await api.channels.remove(channel.id, selectedChild.id);
      } catch (err: any) {
        showMessage(err.message || 'Failed to remove channel.', 'error');
        api.channels.list(selectedChild.id).then(setChannels).catch(() => {});
      }
      delete removeTimeouts.current[channel.id];
    }, 5000);

    removeTimeouts.current[channel.id] = timeout;

    showMessage(`Channel removed`, 'info', 5000, () => {
      clearTimeout(removeTimeouts.current[channel.id]);
      delete removeTimeouts.current[channel.id];
      setChannels((prev) => [...prev, channel]); // Restore
      setMessage({ text: '', type: '' });
    });
  };

  // ─── Action: Open Video Manager ───────────────────────────────────────────
  const handleOpenVideoManager = async (channelId: string) => {
    if (!selectedChild) return;
    setManagingChannelId(channelId);
    setLoadingVideos(true);
    try {
      const channelVideosData = await api.videos.list(selectedChild.id, true, channelId);
      setChannelVideos(channelVideosData);
    } catch {
      setChannelVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  };

  // ─── Action: Toggle Video Visibility ─────────────────────────────────────
  const toggleVideoVisibility = async (videoId: string, isCurrentlyHidden: boolean) => {
    if (!selectedChild) return;
    // Optimistic UI update
    setChannelVideos((prev) =>
      prev.map((v) => (v.id === videoId ? { ...v, isHidden: !isCurrentlyHidden } : v))
    );
    try {
      if (isCurrentlyHidden) {
        await api.videos.unhide(selectedChild.id, videoId);
      } else {
        await api.videos.hide(selectedChild.id, videoId);
      }
    } catch (err: any) {
      // Revert optimistic update on failure
      setChannelVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, isHidden: isCurrentlyHidden } : v))
      );
      showMessage(err.message || 'Failed to update video.', 'error');
    }
  };

  // ─── Render: Profile Selector ─────────────────────────────────────────────
  if (!selectedChild) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-6 bg-red-600 rounded flex items-center justify-center">
              <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-white border-b-[4px] border-b-transparent ml-0.5" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">KidTube Parent Portal</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:block">{userEmail}</span>
            <button onClick={handleLogout} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              Logout
            </button>
          </div>
        </header>

        <main className="p-6 max-w-4xl mx-auto space-y-8 pb-12">

          {/* Who's Watching */}
          <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-semibold mb-6">Who&apos;s Watching?</h2>
            {children.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No child profiles yet. Create one below!</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {children.map((child) => (
                  <div
                    key={child.id}
                    onClick={() => setSelectedChild(child)}
                    className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 rounded-xl border-2 border-transparent hover:border-blue-500 transition-all group relative cursor-pointer"
                  >
                    <button 
                      onClick={(e) => handleDeleteChild(e, child.id)}
                      className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-white/50 hover:bg-red-100 rounded-full text-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Profile"
                    >
                      🗑️
                    </button>
                    <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                      <span className="text-3xl">👦</span>
                    </div>
                    <h3 className="font-medium text-lg">{child.name}</h3>
                    <div className="text-sm text-yellow-500 font-medium flex items-center gap-1 mt-1">
                      <span>⭐</span> {child.stars || 0}
                    </div>
                    </div>
                ))}
              </div>
            )}
            <form onSubmit={handleCreateChild} className="flex gap-4 max-w-md">
              <input
                type="text"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                placeholder="New child&apos;s name"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700"
              />
              <button
                type="submit"
                disabled={loadingChild || !newChildName.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {loadingChild ? 'Creating...' : 'Add Profile'}
              </button>
            </form>
          </section>

          {/* Global Settings */}
          <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
            <h2 className="text-xl font-semibold">Global App Settings</h2>

            {[
              {
                label: 'Disable YouTube Shorts',
                desc: 'Hide the Shorts tab entirely in the child app.',
                value: disableShorts,
                onChange: (v: boolean) => { setDisableShorts(v); updateGlobalSetting('disableShorts', v); },
              },
              {
                label: 'Educational Tollbooth (Gamification)',
                desc: 'Every 3 videos, child must solve a math problem to earn ⭐ Stars.',
                value: educationalTollbooth,
                onChange: (v: boolean) => { setEducationalTollbooth(v); updateGlobalSetting('educationalTollbooth', v); },
              },
            ].map(({ label, desc, value, onChange }) => (
              <div key={label} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4 last:border-0 last:pb-0">
                <div>
                  <span className="font-medium block">{label}</span>
                  <span className="text-xs text-gray-500">{desc}</span>
                </div>
                <button
                  onClick={() => onChange(!value)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                  aria-label={`Toggle ${label}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${value ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
          </section>

          {/* Device Password */}
          <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-1">Child App Login Password</h2>
            <p className="text-sm text-gray-500 mb-4">Set the password used to log into the child&apos;s tablet or phone.</p>
            <form onSubmit={handleSetDevicePassword} className="flex gap-4">
              <input
                type="password"
                value={devicePassword}
                onChange={(e) => setDevicePassword(e.target.value)}
                placeholder="New password"
                required
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700"
              />
              <button type="submit" className="px-6 py-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-lg transition-colors">
                Set Password
              </button>
            </form>
            {devicePasswordMsg.text && (
              <p className={`mt-3 text-sm ${devicePasswordMsg.type === 'error' ? 'text-red-500' : devicePasswordMsg.type === 'success' ? 'text-green-500' : 'text-blue-500'}`}>
                {devicePasswordMsg.text}
              </p>
            )}
          </section>
        </main>
      </div>
    );
  }

  // ─── Render: Child Dashboard ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedChild(null)} className="text-blue-600 font-medium hover:underline text-sm">
            ← Profiles
          </button>
          <h1 className="text-xl font-bold">{selectedChild.name}&apos;s Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-base font-bold text-yellow-500 flex items-center gap-1">
            <span>⭐</span> {selectedChild.stars || 0}
          </div>
          <button onClick={handleLogout} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            Logout
          </button>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-8 pb-12">

        {/* Screen Time & Limits */}
        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Screen Time &amp; Limits</h2>
            <button
              onClick={handleUpdateChildSettings}
              disabled={savingSettings}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Daily Screen Time Limit (Minutes)</label>
              <input
                type="number"
                min={0}
                value={dailyLimitMins}
                onChange={(e) => setDailyLimitMins(Number(e.target.value))}
                className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700"
              />
              <p className="text-xs text-gray-500 mt-1">Set to 0 for unlimited. App locks when the limit is reached.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Bedtime Lock (24h format)</label>
              <input
                type="time"
                value={bedtime}
                onChange={(e) => setBedtime(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700"
              />
              <p className="text-xs text-gray-500 mt-1">e.g. 20:00. Leave blank for no bedtime.</p>
            </div>
          </div>
          {message.text && message.text.includes('Settings') && (
            <p className={`mt-4 text-sm font-medium ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
              {message.text}
            </p>
          )}
        </section>

        {/* Channel Management */}
        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Add Channels for {selectedChild.name}</h2>
          <form onSubmit={handleAddChannel} className="flex gap-4 mb-6">
            <input
              type="text"
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
              placeholder="e.g. @Blippi, @Cocomelon"
              disabled={loadingChannel}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700"
            />
            <button
              type="submit"
              disabled={loadingChannel || !newChannel.trim()}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {loadingChannel ? 'Analyzing...' : 'Allow Channel'}
            </button>
          </form>

          {message.text && !message.text.includes('Settings') && (
            <div className={`p-4 mb-6 rounded-lg text-sm flex justify-between items-center ${message.type === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : message.type === 'info' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'}`}>
              <span>{message.text}</span>
              {message.onUndo && (
                <button onClick={message.onUndo} className="font-semibold underline ml-4 hover:opacity-80">
                  Undo
                </button>
              )}
            </div>
          )}

          <h3 className="font-semibold text-lg mb-4">Approved Channels</h3>
          {channels.length === 0 ? (
            <p className="text-gray-500 text-sm">No channels approved yet. Add one above!</p>
          ) : (
            <div className="flex flex-col gap-3">
              {channels.map((channel) => (
                <div key={channel.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700">
                  <p className="font-medium">{channel.channelTitle || channel.channelId}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenVideoManager(channel.channelId)}
                      className="px-3 py-1 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      Manage Videos
                    </button>
                    <button
                      onClick={() => handleRemoveChannel(channel)}
                      className="text-red-500 hover:text-red-700 font-medium text-sm transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Watch History */}
        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Watch History</h2>
          {loadingHistory ? (
            <div className="py-8 text-center text-gray-500">Loading...</div>
          ) : watchHistory.length === 0 ? (
            <p className="text-gray-500">No history yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {watchHistory.map((item, idx) => (
                <div key={`${item.videoId}-${idx}`} className="flex gap-4 items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  {item.thumbnail && (
                    <img src={item.thumbnail} alt={item.title} className="w-24 h-16 object-cover rounded flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.channelTitle}</p>
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(item.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Manage Videos Modal */}
      {managingChannelId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setManagingChannelId(null)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-3xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Manage Videos</h2>
                <p className="text-sm text-gray-500">Hide specific videos you don&apos;t want your child to see.</p>
              </div>
              <button onClick={() => setManagingChannelId(null)} className="text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {loadingVideos ? (
                <p className="text-center text-gray-500 py-8">Loading videos...</p>
              ) : channelVideos.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No videos found for this channel.</p>
              ) : (
                <div className="grid gap-4">
                  {channelVideos.map((video) => (
                    <div
                      key={video.id}
                      className={`flex gap-4 items-center p-3 rounded-lg border transition-colors ${video.isHidden ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900 opacity-70' : 'bg-gray-50 border-gray-100 dark:bg-gray-900 dark:border-gray-700'}`}
                    >
                      <img
                        src={video.thumbnails?.medium?.url || ''}
                        alt={video.title}
                        className="w-32 h-20 object-cover rounded flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm line-clamp-2 ${video.isHidden ? 'text-red-900 dark:text-red-300' : ''}`}>
                          {video.title}
                        </p>
                        {video.isHidden && (
                          <span className="text-xs font-bold text-red-600 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded mt-2 inline-block">HIDDEN</span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleVideoVisibility(video.id, video.isHidden)}
                        className={`px-4 py-2 rounded font-medium text-sm transition-colors flex-shrink-0 ${video.isHidden ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200'}`}
                      >
                        {video.isHidden ? 'Unhide' : 'Hide'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
