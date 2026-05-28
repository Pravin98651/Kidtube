'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [channels, setChannels] = useState<{id: string, channelId: string, channelTitle?: string, addedAt: string}[]>([]);
  const [newChannel, setNewChannel] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [disableShorts, setDisableShorts] = useState(true);
  const [educationalTollbooth, setEducationalTollbooth] = useState(false);
  const [watchHistory, setWatchHistory] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [devicePassword, setDevicePassword] = useState('');
  const [devicePasswordMsg, setDevicePasswordMsg] = useState({ text: '', type: '' });
  const [loadingPassword, setLoadingPassword] = useState(false);
  const router = useRouter();

  // Authentication & Initial Data Load
  useEffect(() => {
    const token = localStorage.getItem('kidtube_token');
    const email = localStorage.getItem('kidtube_userId');
    
    if (!token) {
      router.push('/login');
      return;
    }
    
    if (email) setUserEmail(email);

    fetchChannels(token);
    fetchSettings(token);
    fetchHistory(token);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('kidtube_token');
    localStorage.removeItem('kidtube_userId');
    router.push('/login');
  };

  const fetchSettings = async (token: string) => {
    try {
      const response = await fetch('https://kidtube-almy.onrender.com/api/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.disableShorts !== undefined) setDisableShorts(data.disableShorts);
      if (data.educationalTollbooth !== undefined) setEducationalTollbooth(data.educationalTollbooth);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const fetchHistory = async (token: string) => {
    try {
      const response = await fetch('https://kidtube-almy.onrender.com/api/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (Array.isArray(data)) setWatchHistory(data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const fetchChannels = async (token: string) => {
    try {
      const response = await fetch('https://kidtube-almy.onrender.com/api/channels', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setChannels(data);
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    }
  };

  const toggleShorts = async () => {
    const newValue = !disableShorts;
    setDisableShorts(newValue);
    updateSetting('disableShorts', newValue);
  };

  const toggleTollbooth = async () => {
    const newValue = !educationalTollbooth;
    setEducationalTollbooth(newValue);
    updateSetting('educationalTollbooth', newValue);
  };

  const updateSetting = async (key: string, value: boolean) => {
    const token = localStorage.getItem('kidtube_token');
    try {
      await fetch('https://kidtube-almy.onrender.com/api/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ [key]: value })
      });
    } catch (error) {
      console.error(`Failed to update ${key}:`, error);
      // We don't revert state here for simplicity, but in prod we should
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannel.trim()) return;
    
    setLoading(true);
    setMessage({ text: '', type: '' });
    
    const token = localStorage.getItem('kidtube_token');
    const query = newChannel.trim();

    try {
      const response = await fetch('https://kidtube-almy.onrender.com/api/channels', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add channel');
      }

      setMessage({ text: `Success! Added channel and processed ${data.videosProcessed} videos.`, type: 'success' });
      setNewChannel('');
      fetchChannels(localStorage.getItem('kidtube_token') || '');
    } catch (error: any) {
      setMessage({ text: `Error: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const removeChannel = async (id: string) => {
    if (!confirm('Are you sure you want to remove this channel?')) return;
    const token = localStorage.getItem('kidtube_token');
    try {
      await fetch(`https://kidtube-almy.onrender.com/api/channels/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchChannels(token || '');
    } catch (error) {
      console.error('Failed to remove channel:', error);
    }
  };

  const handleSetDevicePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devicePassword.trim()) return;
    
    setLoadingPassword(true);
    setDevicePasswordMsg({ text: '', type: '' });
    
    const token = localStorage.getItem('kidtube_token');
    
    try {
      const response = await fetch('https://kidtube-almy.onrender.com/api/device-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: devicePassword.trim() })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to set password');
      }

      setDevicePasswordMsg({ text: 'Device password successfully updated! You can now use it on the child app.', type: 'success' });
      setDevicePassword('');
    } catch (error: any) {
      setDevicePasswordMsg({ text: `Error: ${error.message}`, type: 'error' });
    } finally {
      setLoadingPassword(false);
    }
  };

  if (!userEmail) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">KidTube Parent</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{userEmail}</span>
              <button 
                onClick={handleLogout}
                className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Global Content Settings</h2>
              <p className="text-sm text-gray-500 mt-1">Configure global rules that apply to all channels.</p>
            </div>
            
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
              <div>
                <span className="font-medium block">Disable YouTube Shorts</span>
                <span className="text-xs text-gray-500">Hide the Shorts tab entirely in the child app.</span>
              </div>
              <button 
                onClick={toggleShorts}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${disableShorts ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${disableShorts ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <span className="font-medium block">Educational Tollbooth (Learn to Earn)</span>
                <span className="text-xs text-gray-500">Require the child to answer a simple math question every 3 videos.</span>
              </div>
              <button 
                onClick={toggleTollbooth}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${educationalTollbooth ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${educationalTollbooth ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-2">Child Device Access</h2>
            <p className="text-sm text-gray-500 mb-4">Set a password to use when logging into the KidTube Child App.</p>
            <form onSubmit={handleSetDevicePassword} className="flex gap-4">
              <input
                type="text"
                value={devicePassword}
                onChange={(e) => setDevicePassword(e.target.value)}
                placeholder="e.g. kid123"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700"
                disabled={loadingPassword}
              />
              <button
                type="submit"
                disabled={loadingPassword || !devicePassword}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {loadingPassword ? 'Saving...' : 'Set Password'}
              </button>
            </form>
            
            {devicePasswordMsg.text && (
              <div className={`mt-4 p-4 rounded-lg ${devicePasswordMsg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {devicePasswordMsg.text}
              </div>
            )}
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Allow a New Channel</h2>
            <form onSubmit={handleAddChannel} className="flex gap-4">
              <input
                type="text"
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                placeholder="e.g. @KhanAcademy or UC... ID"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !newChannel}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {loading ? 'Adding...' : 'Allow Channel'}
              </button>
            </form>
            
            {message.text && (
              <div className={`mt-4 p-4 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {message.text}
              </div>
            )}
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Approved Channels</h2>
            {channels.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                No channels approved yet. Add one above!
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                {channels.map((channel) => (
                  <div key={channel.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="font-medium">{channel.channelTitle || channel.channelId}</p>
                      <p className="text-xs text-gray-500">Added: {new Date(channel.addedAt).toLocaleDateString()}</p>
                    </div>
                    <button 
                      onClick={() => removeChannel(channel.id)}
                      className="px-3 py-1 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Watch History</h2>
            {watchHistory.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                No history yet. Videos watched by the child will appear here.
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {watchHistory.map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700">
                    {item.thumbnail && (
                      <img src={item.thumbnail} alt="Thumbnail" className="w-24 h-16 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{item.channelTitle}</p>
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
