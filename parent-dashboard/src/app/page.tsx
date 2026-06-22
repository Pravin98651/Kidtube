'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  // Global Auth & Settings State
  const [token, setToken] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [disableShorts, setDisableShorts] = useState(true);
  const [educationalTollbooth, setEducationalTollbooth] = useState(false);
  const [devicePassword, setDevicePassword] = useState('');
  const [devicePasswordMsg, setDevicePasswordMsg] = useState({ text: '', type: '' });
  
  // Children State
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any | null>(null);
  const [newChildName, setNewChildName] = useState('');
  const [loadingChild, setLoadingChild] = useState(false);
  
  // Child Dashboard State
  const [channels, setChannels] = useState<any[]>([]);
  const [watchHistory, setWatchHistory] = useState<any[]>([]);
  const [newChannel, setNewChannel] = useState('');
  const [loadingChannel, setLoadingChannel] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Child Settings State
  const [dailyLimitMins, setDailyLimitMins] = useState(60);
  const [bedtime, setBedtime] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Manage Videos State
  const [managingChannelId, setManagingChannelId] = useState<string | null>(null);
  const [channelVideos, setChannelVideos] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const tk = localStorage.getItem('kidtube_token');
    const email = localStorage.getItem('kidtube_userId');
    if (!tk) {
      router.push('/login');
      return;
    }
    setToken(tk);
    if (email) setUserEmail(email);

    fetchGlobalSettings(tk);
    fetchChildren(tk);
  }, [router]);

  useEffect(() => {
    if (selectedChild && token) {
      setDailyLimitMins(selectedChild.dailyLimitMins || 60);
      setBedtime(selectedChild.bedtime || '');
      fetchChannels(token, selectedChild.id);
      fetchHistory(token, selectedChild.id);
    }
  }, [selectedChild, token]);

  const handleLogout = () => {
    localStorage.removeItem('kidtube_token');
    localStorage.removeItem('kidtube_userId');
    router.push('/login');
  };

  // --- API FETCHERS ---
  const fetchGlobalSettings = async (tk: string) => {
    try {
      const res = await fetch('https://kidtube-almy.onrender.com/api/settings', { headers: { 'Authorization': `Bearer ${tk}` } });
      if (!res.ok) return;
      const data = await res.json();
      if (data.disableShorts !== undefined) setDisableShorts(data.disableShorts);
      if (data.educationalTollbooth !== undefined) setEducationalTollbooth(data.educationalTollbooth);
    } catch (e) { console.error('Error fetching global settings', e); }
  };

  const fetchChildren = async (tk: string) => {
    try {
      const res = await fetch('https://kidtube-almy.onrender.com/api/children', { headers: { 'Authorization': `Bearer ${tk}` } });
      const data = await res.json();
      if (res.ok) setChildren(data);
    } catch (e) { console.error('Error fetching children', e); }
  };

  const fetchChannels = async (tk: string, childId: string) => {
    if (!childId) return;
    try {
      const res = await fetch(`https://kidtube-almy.onrender.com/api/channels?childId=${childId}`, { headers: { 'Authorization': `Bearer ${tk}` } });
      const data = await res.json();
      if (res.ok) setChannels(data);
      else setChannels([]);
    } catch (e) { console.error('Error fetching channels', e); }
  };

  const fetchHistory = async (tk: string, childId: string) => {
    if (!childId) return;
    try {
      const res = await fetch(`https://kidtube-almy.onrender.com/api/history?childId=${childId}`, { headers: { 'Authorization': `Bearer ${tk}` } });
      const data = await res.json();
      if (res.ok) setWatchHistory(data);
      else setWatchHistory([]);
    } catch (e) { console.error('Error fetching history', e); }
  };

  const fetchChannelVideos = async (channelId: string) => {
    if (!selectedChild) return;
    setLoadingVideos(true);
    try {
      const res = await fetch(`https://kidtube-almy.onrender.com/api/videos?childId=${selectedChild.id}&includeHidden=true`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        const filtered = data.filter((v: any) => v.channelId === channelId);
        setChannelVideos(filtered);
      } else {
        setChannelVideos([]);
      }
    } catch (e) { console.error('Error fetching videos', e); }
    setLoadingVideos(false);
  };

  // --- ACTION HANDLERS ---
  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildName.trim() || !token) return;
    setLoadingChild(true);
    try {
      const res = await fetch('https://kidtube-almy.onrender.com/api/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newChildName })
      });
      if (res.ok) {
        setNewChildName('');
        fetchChildren(token);
      }
    } catch (e) { console.error('Failed to create child', e); }
    setLoadingChild(false);
  };

  const handleUpdateChildSettings = async () => {
    if (!selectedChild || !token) return;
    setSavingSettings(true);
    try {
      const res = await fetch(`https://kidtube-almy.onrender.com/api/children/${selectedChild.id}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ dailyLimitMins, bedtime })
      });
      if (res.ok) {
        setMessage({ text: 'Settings saved!', type: 'success' });
        // Update selectedChild locally so the lock screen reflects new settings immediately
        setSelectedChild((prev: any) => prev ? { ...prev, dailyLimitMins, bedtime } : prev);
        fetchChildren(token);
      } else {
        setMessage({ text: 'Failed to save settings.', type: 'error' });
      }
    } catch (e) { setMessage({ text: 'Failed to save settings', type: 'error' }); }
    setSavingSettings(false);
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const updateGlobalSetting = async (key: string, value: boolean) => {
    try {
      await fetch('https://kidtube-almy.onrender.com/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ [key]: value })
      });
    } catch (error) { console.error(`Failed to update ${key}:`, error); }
  };

  const handleSetDevicePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevicePasswordMsg({ text: 'Setting password...', type: 'info' });
    try {
      const res = await fetch('https://kidtube-almy.onrender.com/api/device-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ password: devicePassword })
      });
      if (res.ok) {
        setDevicePasswordMsg({ text: 'Password set! Use this to log into the child app.', type: 'success' });
        setDevicePassword('');
      } else { setDevicePasswordMsg({ text: 'Failed to set password.', type: 'error' }); }
    } catch (e) { setDevicePasswordMsg({ text: 'Network error.', type: 'error' }); }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannel || !selectedChild) return;
    setLoadingChannel(true);
    setMessage({ text: 'Analyzing safety...', type: 'info' });
    
    try {
      const res = await fetch('https://kidtube-almy.onrender.com/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ query: newChannel, childId: selectedChild.id })
      });
      const data = await res.json();
      if (res.ok) {
        setNewChannel('');
        setMessage({ text: data.message || `Successfully added channels.`, type: 'success' });
        fetchChannels(token, selectedChild.id);
      } else { setMessage({ text: data.error || 'Failed to add channel.', type: 'error' }); }
    } catch (e) { setMessage({ text: 'Network error.', type: 'error' }); }
    setLoadingChannel(false);
  };

  const handleRemoveChannel = async (channelId: string) => {
    if (!confirm('Remove this channel for this child?') || !selectedChild) return;
    try {
      await fetch(`https://kidtube-almy.onrender.com/api/channels/${channelId}?childId=${selectedChild.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchChannels(token, selectedChild.id);
    } catch (e) { console.error('Failed to remove channel'); }
  };

  const toggleVideoVisibility = async (videoId: string, isCurrentlyHidden: boolean) => {
    if (!selectedChild) return;
    const endpoint = isCurrentlyHidden ? 'unhide' : 'hide';
    try {
      // Optimistic UI update
      setChannelVideos(prev => prev.map(v => v.id === videoId ? { ...v, isHidden: !isCurrentlyHidden } : v));
      await fetch(`https://kidtube-almy.onrender.com/api/videos/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ childId: selectedChild.id, videoId })
      });
    } catch (e) { console.error('Failed to toggle video visibility'); }
  };

  // --- RENDERERS ---

  if (!selectedChild) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center sticky top-0 z-10">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">KidTube Parent Portal</h1>
          <button onClick={handleLogout} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Logout</button>
        </header>

        <main className="p-8 max-w-4xl mx-auto space-y-8">
          <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-semibold mb-6">Who&apos;s Watching?</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {children.map(child => (
                <button 
                  key={child.id}
                  onClick={() => setSelectedChild(child)}
                  className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 rounded-xl border-2 border-transparent hover:border-blue-500 transition-all group"
                >
                  <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <span className="text-3xl">👦</span>
                  </div>
                  <h3 className="font-medium text-lg">{child.name}</h3>
                  <div className="text-sm text-yellow-500 font-medium flex items-center gap-1 mt-1">
                    <span>⭐</span> {child.stars || 0}
                  </div>
                </button>
              ))}
            </div>

            <form onSubmit={handleCreateChild} className="flex gap-4 max-w-md">
              <input type="text" value={newChildName} onChange={e => setNewChildName(e.target.value)} placeholder="New Child&apos;s Name" className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700" />
              <button type="submit" disabled={loadingChild || !newChildName} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50">Add Profile</button>
            </form>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
            <h2 className="text-xl font-semibold">Global App Settings</h2>
            
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
              <div>
                <span className="font-medium block">Disable YouTube Shorts</span>
                <span className="text-xs text-gray-500">Hide the Shorts tab entirely in the child app.</span>
              </div>
              <button onClick={() => { const v = !disableShorts; setDisableShorts(v); updateGlobalSetting('disableShorts', v); }} className={`w-12 h-6 rounded-full p-1 transition-colors ${disableShorts ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${disableShorts ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <span className="font-medium block">Educational Tollbooth (Gamification)</span>
                <span className="text-xs text-gray-500">Every 3 videos, child must solve math to earn 10 Stars and unlock the video.</span>
              </div>
              <button onClick={() => { const v = !educationalTollbooth; setEducationalTollbooth(v); updateGlobalSetting('educationalTollbooth', v); }} className={`w-12 h-6 rounded-full p-1 transition-colors ${educationalTollbooth ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${educationalTollbooth ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </section>
          
          <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-2">Child App Login Password</h2>
            <p className="text-sm text-gray-500 mb-4">Set the password you will use to log into the tablet/phone app.</p>
            <form onSubmit={handleSetDevicePassword} className="flex gap-4">
              <input type="password" value={devicePassword} onChange={(e) => setDevicePassword(e.target.value)} placeholder="New Password" required className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700" />
              <button type="submit" className="px-6 py-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-lg">Set Password</button>
            </form>
            {devicePasswordMsg.text && <p className={`mt-3 text-sm ${devicePasswordMsg.type === 'error' ? 'text-red-500' : devicePasswordMsg.type === 'success' ? 'text-green-500' : 'text-blue-500'}`}>{devicePasswordMsg.text}</p>}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedChild(null)} className="text-blue-600 font-medium hover:underline">← Back to Profiles</button>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{selectedChild.name}&apos;s Dashboard</h1>
        </div>
        <div className="text-xl font-bold text-yellow-500 flex items-center gap-2">
          <span>⭐</span> {selectedChild.stars || 0} Stars
        </div>
      </header>

      <main className="p-8 max-w-4xl mx-auto space-y-8">
        
        {/* Child Specific Settings */}
        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Screen Time & Limits</h2>
            <button onClick={handleUpdateChildSettings} disabled={savingSettings} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">Save Settings</button>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Daily Screen Time Limit (Minutes)</label>
              <input type="number" value={dailyLimitMins} onChange={e => setDailyLimitMins(Number(e.target.value))} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700" />
              <p className="text-xs text-gray-500 mt-1">Set to 0 for unlimited. App will lock when reached.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Bedtime Lock (24h format)</label>
              <input type="time" value={bedtime} onChange={e => setBedtime(e.target.value)} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700" />
              <p className="text-xs text-gray-500 mt-1">e.g. 20:00. Leave blank for no bedtime.</p>
            </div>
          </div>
          {message.text && message.text.includes('Settings') && <p className="mt-4 text-green-500 text-sm font-medium">{message.text}</p>}
        </section>

        {/* Channels Management */}
        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Add Channels for {selectedChild.name}</h2>
          <form onSubmit={handleAddChannel} className="flex gap-4 mb-8">
            <input type="text" value={newChannel} onChange={e => setNewChannel(e.target.value)} placeholder="e.g. @Blippi, @Cocomelon" className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700" disabled={loadingChannel} />
            <button type="submit" disabled={loadingChannel || !newChannel} className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-lg">
              {loadingChannel ? 'Analyzing...' : 'Allow Channel'}
            </button>
          </form>
          {message.text && !message.text.includes('Settings') && (
            <div className={`p-4 mb-8 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : message.type === 'info' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
              {message.text}
            </div>
          )}

          <h3 className="font-semibold text-lg mb-4">Approved Channels</h3>
          <div className="flex flex-col gap-3">
            {channels.map((channel) => (
              <div key={channel.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700">
                <p className="font-medium">{channel.channelTitle || channel.channelId}</p>
                <div className="flex gap-2">
                  <button onClick={() => { setManagingChannelId(channel.channelId); fetchChannelVideos(channel.channelId); }} className="px-3 py-1 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40">Manage Videos</button>
                  <button onClick={() => handleRemoveChannel(channel.id)} className="px-3 py-1 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/40">Remove</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Watch History */}
        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Watch History</h2>
          {watchHistory.length === 0 ? <p className="text-gray-500">No history yet.</p> : (
            <div className="flex flex-col gap-3">
              {watchHistory.map((item, idx) => (
                <div key={idx} className="flex gap-4 items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  {item.thumbnail && <img src={item.thumbnail} alt="" className="w-24 h-16 object-cover rounded" />}
                  <div className="flex-1">
                    <p className="font-medium text-sm truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.channelTitle}</p>
                  </div>
                  <div className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* MANAGE VIDEOS MODAL */}
      {managingChannelId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 w-full max-w-3xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Manage Videos</h2>
                <p className="text-sm text-gray-500">Hide specific videos you don&apos;t want your child to see.</p>
              </div>
              <button onClick={() => setManagingChannelId(null)} className="text-gray-400 hover:text-gray-900 text-2xl font-bold">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {loadingVideos ? <p className="text-center text-gray-500">Loading videos...</p> : (
                <div className="grid gap-4">
                  {channelVideos.map(video => (
                    <div key={video.id} className={`flex gap-4 items-center p-3 rounded-lg border ${video.isHidden ? 'bg-red-50 border-red-100 opacity-70' : 'bg-gray-50 border-gray-100'}`}>
                      <img src={video.thumbnails?.medium?.url || ''} className="w-32 h-20 object-cover rounded" />
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm line-clamp-2 ${video.isHidden ? 'text-red-900' : ''}`}>{video.title}</p>
                        {video.isHidden && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded mt-2 inline-block">HIDDEN</span>}
                      </div>
                      <button 
                        onClick={() => toggleVideoVisibility(video.id, video.isHidden)}
                        className={`px-4 py-2 rounded font-medium text-sm transition-colors ${video.isHidden ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
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
