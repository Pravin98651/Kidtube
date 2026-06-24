import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Image, Platform, ActivityIndicator, FlatList, Dimensions, TextInput, KeyboardAvoidingView, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SafeVideoPlayer from './components/SafeVideoPlayer';
import MathTollbooth from './components/MathTollbooth';
import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useApi } from './hooks/useApi';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface Video {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnails?: any;
  thumbnail?: string;
  publishedAt?: string;
  duration?: number;
}

const getThumbnailUrl = (video: Video) => {
  if (video.thumbnail) return video.thumbnail;
  if (video.thumbnails) {
    return video.thumbnails.maxres?.url || 
           video.thumbnails.high?.url || 
           video.thumbnails.medium?.url || 
           video.thumbnails.default?.url ||
           '';
  }
  return 'https://via.placeholder.com/640x360.png?text=No+Thumbnail';
};

// Memoized Video Card for performance (Home Feed)
const VideoCard = memo(({ video, onPress }: { video: Video, onPress: () => void }) => {
  return (
    <TouchableOpacity style={styles.videoCard} onPress={onPress} activeOpacity={0.9}>
      <Image source={{ uri: getThumbnailUrl(video) }} style={styles.thumbnail} resizeMode="cover" />
      {video.duration ? (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            {video.duration >= 3600 ? `${Math.floor(video.duration / 3600)}:` : ''}
            {Math.floor((video.duration % 3600) / 60)}:
            {(video.duration % 60).toString().padStart(2, '0')}
          </Text>
        </View>
      ) : null}
      <View style={styles.videoDetailsContainer}>
        <Image 
          source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(video.channelTitle)}&background=random&color=fff&rounded=true` }} 
          style={styles.channelAvatar} 
        />
        <View style={styles.videoTextContainer}>
          <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
          <Text style={styles.videoSubtitle}>
            {video.channelTitle} • {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : 'Recent'}
          </Text>
        </View>
        <View style={styles.menuDots}>
          <View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} />
        </View>
      </View>
    </TouchableOpacity>
  );
});
VideoCard.displayName = 'VideoCard';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Settings & Gamification
  const [disableShorts, setDisableShorts] = useState(false);
  const [educationalTollbooth, setEducationalTollbooth] = useState(false);
  const [videosWatchedCount, setVideosWatchedCount] = useState(0);
  const [showTollbooth, setShowTollbooth] = useState(false);
  
  // Child Profiles State
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any | null>(null);
  const [timeSpentToday, setTimeSpentToday] = useState(0);

  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentTab, setCurrentTab] = useState<'Home' | 'Shorts'>('Home');
  const [playingShortId, setPlayingShortId] = useState<string | null>(null);
  
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(false);

  // Override State
  const [overrideUnlocked, setOverrideUnlocked] = useState(false);
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [overridePassword, setOverridePassword] = useState('');

  const [viewabilityConfig] = useState(() => ({ itemVisiblePercentThreshold: 50 }));
  const [onViewableItemsChanged] = useState(() => ({ viewableItems }: any) => {
    const visibleItem = viewableItems.find((item: any) => item.isViewable);
    if (visibleItem) {
      setPlayingShortId(visibleItem.item.videoId);
    }
  });

  const baseUrl = 'https://kidtube-almy.onrender.com'; // kept for login handler below
  const api = useApi();

  // INITIAL LOAD
  useEffect(() => {
    const checkToken = async () => {
      const storedToken = await AsyncStorage.getItem('kidtube_token');
      if (storedToken) setToken(storedToken);
    };
    checkToken();
  }, []);

  // FETCH GLOBAL SETTINGS & CHILDREN
  useEffect(() => {
    if (!token) return;
    const fetchInitialData = async () => {
      const [settings, childrenData] = await Promise.all([
        api.getSettings(),
        api.getChildren(),
      ]);
      if (settings) {
        if (settings.disableShorts !== undefined) setDisableShorts(settings.disableShorts);
        if (settings.educationalTollbooth !== undefined) setEducationalTollbooth(settings.educationalTollbooth);
      }
      if (childrenData) {
        setChildren(childrenData);
      } else {
        handleLogout(); // token is invalid
      }
    };
    fetchInitialData();
  }, [token]);

  // FETCH CHILD-SPECIFIC DATA
  useEffect(() => {
    if (!token || !selectedChild) return;
    
    const fetchVideos = async () => {
      // Load from cache first for instant UI
      try {
        const cachedVids = await AsyncStorage.getItem(`kidtube_cached_videos_${selectedChild.id}`);
        if (cachedVids) {
          const parsedVids = JSON.parse(cachedVids);
          setVideos(parsedVids);
          const uniqueChannelTitles = Array.from(new Set(parsedVids.map((v: Video) => v.channelTitle))).filter(Boolean);
          setCategories(['All', ...uniqueChannelTitles] as string[]);
        }
      } catch (e) {}

      setLoading(true);
      const vids = await api.getVideos(selectedChild.id);
      if (vids) {
        setVideos(vids);
        AsyncStorage.setItem(`kidtube_cached_videos_${selectedChild.id}`, JSON.stringify(vids));
        const uniqueChannelTitles = Array.from(new Set(vids.map((v: any) => v.channelTitle))).filter(Boolean);
        setCategories(['All', ...uniqueChannelTitles] as string[]);
      }
      setLoading(false);
    };

    fetchVideos();

    // Initialize today's screen time from storage
    const today = new Date().toISOString().split('T')[0];
    AsyncStorage.getItem(`timeSpent_${selectedChild.id}_${today}`).then(val => {
      setTimeSpentToday(val ? parseInt(val, 10) : 0);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedChild?.id]);

  // SCREEN TIME TRACKING LOOP (fixed stale closure via useRef)
  const timeSpentTodayRef = useRef(timeSpentToday);
  useEffect(() => { timeSpentTodayRef.current = timeSpentToday; }, [timeSpentToday]);

  useEffect(() => {
    if (!selectedChild) return;
    const childId = selectedChild.id;
    const interval = setInterval(() => {
      const next = timeSpentTodayRef.current + 1;
      timeSpentTodayRef.current = next;
      setTimeSpentToday(next);
      const today = new Date().toISOString().split('T')[0];
      AsyncStorage.setItem(`timeSpent_${childId}_${today}`, String(next));
    }, 60000); // 1 minute
    return () => clearInterval(interval);
  }, [selectedChild?.id]);

  const isLocked = () => {
    if (!selectedChild) return false;
    // dailyLimitMins === 0 means unlimited — only lock if limit is explicitly set (> 0)
    if (selectedChild.dailyLimitMins > 0 && timeSpentToday >= selectedChild.dailyLimitMins) return true;
    if (selectedChild.bedtime && selectedChild.bedtime.length === 5) {
      const now = new Date();
      const currentStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      if (currentStr >= selectedChild.bedtime) return true;
    }
    return false;
  };

  const handleLogin = async () => {
    if (!email || !password) return;
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await AsyncStorage.setItem('kidtube_token', data.token);
      setToken(data.token);
    } catch (err: any) { setLoginError(err.message); } 
    finally { setIsLoggingIn(false); }
  };

  const logHistory = async (video: Video) => {
    if (!selectedChild) return;
    await api.logHistory(selectedChild.id, {
      videoId: video.videoId,
      title: video.title,
      channelTitle: video.channelTitle,
      thumbnail: getThumbnailUrl(video),
    });
  };

  const handleVideoSelect = (video: Video) => {
    setActiveVideo(video.videoId);
    logHistory(video);
    if (educationalTollbooth) {
      const newCount = videosWatchedCount + 1;
      setVideosWatchedCount(newCount);
      if (newCount >= 3) setShowTollbooth(true);
    }
  };

  const handleTollboothSuccess = async () => {
    setShowTollbooth(false);
    setVideosWatchedCount(0);
    if (!selectedChild) return;
    const newStars = (selectedChild.stars || 0) + 10;
    setSelectedChild({ ...selectedChild, stars: newStars });
    await api.awardStars(selectedChild.id, 10);
  };

  const renderHomeItem = useCallback(({ item }: { item: Video }) => (
    <VideoCard video={item} onPress={() => handleVideoSelect(item)} />
  ), [handleVideoSelect]);

  const renderShortItem = useCallback(({ item: video }: { item: Video }) => (
    <View style={styles.shortCard}>
      <Image source={{ uri: getThumbnailUrl(video) }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={3} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
      {playingShortId === video.videoId ? (
        <View style={styles.shortPlayerWrapper}>
          <SafeVideoPlayer videoId={video.videoId} vertical={true} />
        </View>
      ) : (
        <TouchableOpacity style={styles.shortPlayButton} onPress={() => setPlayingShortId(video.videoId)} activeOpacity={0.8}>
          <View style={styles.shortPlayIcon}><View style={styles.shortPlayTriangle} /></View>
        </TouchableOpacity>
      )}
      <View style={styles.shortOverlay}>
        <Text style={styles.shortTitle} numberOfLines={2}>{video.title}</Text>
        <View style={styles.shortChannelRow}>
          <Image source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(video.channelTitle)}&background=random&color=fff&rounded=true&size=32` }} style={styles.shortChannelAvatar} />
          <Text style={styles.shortSubtitle}>{video.channelTitle}</Text>
        </View>
      </View>
    </View>
  ), [playingShortId]);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('kidtube_token');
    setToken(null);
    setSelectedChild(null);
  };

  if (!token) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <View style={styles.logoContainer}>
            <View style={styles.youtubeIcon}><View style={styles.playTriangle} /></View>
            <Text style={styles.headerTitle}>KidTube Login</Text>
          </View>
          <Text style={styles.loginSubtitle}>Parent authentication required</Text>
          {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
          <TextInput style={styles.input} placeholder="Parent Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Device Password" value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={isLoggingIn}>
            <Text style={styles.loginBtnText}>{isLoggingIn ? 'Logging in...' : 'Link Device'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // PROFILE SELECTOR SCREEN
  if (!selectedChild) {
    return (
      <SafeAreaView style={styles.profileContainer}>
        <View style={styles.profileHeader}>
          <Text style={styles.profileTitle}>Who's Watching?</Text>
          <TouchableOpacity onPress={handleLogout}><Text style={styles.logoutText}>Logout</Text></TouchableOpacity>
        </View>
        {children.length === 0 ? (
          <Text style={styles.emptyText}>No profiles found. Create one in the Parent Dashboard!</Text>
        ) : (
          <View style={styles.profilesGrid}>
            {children.map(child => (
              <TouchableOpacity key={child.id} style={styles.profileCard} onPress={() => setSelectedChild(child)}>
                <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>👦</Text></View>
                <Text style={styles.profileName}>{child.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </SafeAreaView>
    );
  }

  // Parent Override Handlers

  const handleOverrideUnlock = async () => {
    if (!overridePassword) return;
    try {
      const res = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: overridePassword })
      });
      if (res.ok) {
        setOverrideUnlocked(true);
        setShowOverrideInput(false);
        setOverridePassword('');
      } else {
        alert('Incorrect password');
      }
    } catch (e) {
      alert('Error verifying password');
    }
  };

  // SLEEP MODE LOCK SCREEN
  if (isLocked() && !overrideUnlocked) {
    return (
      <View style={styles.sleepContainer}>
        <Text style={styles.sleepIcon}>😴</Text>
        <Text style={styles.sleepTitle}>Time to Rest!</Text>
        <Text style={styles.sleepSubtitle}>You've reached your screen time limit or it's past bedtime.</Text>
        
        {showOverrideInput ? (
          <View style={{ width: '80%', marginTop: 20 }}>
            <TextInput
              style={styles.input}
              placeholder="Parent Password"
              secureTextEntry
              value={overridePassword}
              onChangeText={setOverridePassword}
            />
            <TouchableOpacity style={styles.loginBtn} onPress={handleOverrideUnlock}>
              <Text style={styles.loginBtnText}>Unlock</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 10 }} onPress={() => setShowOverrideInput(false)}>
              <Text style={{ textAlign: 'center', color: '#666' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.switchProfileBtn} onPress={() => { setSelectedChild(null); setOverrideUnlocked(false); }}>
              <Text style={styles.switchProfileText}>Switch Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 20 }} onPress={() => setShowOverrideInput(true)}>
              <Text style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>Parent Override</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  const shortsVideos = disableShorts ? [] : videos.filter(v => v.duration && v.duration <= 61);
  const regularVideos = videos.filter(v => !v.duration || v.duration > 61);
  const filteredHomeVideos = selectedCategory === 'All' ? regularVideos : regularVideos.filter(v => v.channelTitle === selectedCategory);

  const handleShortsTab = () => {
    setCurrentTab('Shorts');
    if (shortsVideos.length > 0 && !playingShortId) setPlayingShortId(shortsVideos[0].videoId);
  };


  const ListHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.youtubeIcon}><View style={styles.playTriangle} /></View>
          <Text style={styles.headerTitle}>YouTube</Text>
        </View>
        <View style={styles.headerIcons}>
          <View style={styles.starBadge}>
            <Text style={styles.starBadgeText}>⭐ {selectedChild.stars || 0}</Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedChild(null)}><Text style={{fontSize: 24}}>👦</Text></TouchableOpacity>
        </View>
      </View>
      <View style={styles.categoriesWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.categoryPill, selectedCategory === item && styles.categoryPillActive]} onPress={() => setSelectedCategory(item)}>
              <Text style={[styles.categoryText, selectedCategory === item && styles.categoryTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.categoriesContainer}
        />
      </View>
    </View>
  );

  const renderShortsTab = () => {
    if (shortsVideos.length === 0) {
      return (
        <View style={styles.shortsContainer}>
          <View style={styles.shortsHeader}>
            <View style={styles.youtubeIcon}><View style={styles.playTriangle} /></View>
            <Text style={styles.shortsHeaderTitle}>Shorts</Text>
          </View>
          <View style={styles.shortsEmptyContainer}>
            <Text style={styles.shortsEmptyIcon}>⚡</Text>
            <Text style={styles.shortsEmptyTitle}>No Shorts yet</Text>
            <Text style={styles.shortsEmptySubtitle}>Shorts from your approved channels will appear here.</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.shortsContainer}>
        <View style={styles.shortsHeader}>
          <View style={styles.youtubeIcon}><View style={styles.playTriangle} /></View>
          <Text style={styles.shortsHeaderTitle}>Shorts</Text>
        </View>
        <FlatList
          data={shortsVideos}
          keyExtractor={(item) => item.videoId}
          renderItem={renderShortItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={SCREEN_HEIGHT - 190}
          snapToAlignment="start"
          windowSize={3}
          initialNumToRender={2}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={currentTab === 'Shorts' ? 'light' : 'dark'} />
      {currentTab === 'Home' ? (
        <View style={{ flex: 1 }}>
          {activeVideo && (
            <View style={styles.playerSectionPinned}>
              <SafeVideoPlayer key={activeVideo} videoId={activeVideo} />
              <View style={styles.playerInfoRow}>
                <Text style={styles.nowPlayingText}>Now Playing</Text>
                <TouchableOpacity style={styles.closeButtonSmall} onPress={() => setActiveVideo(null)}>
                  <Text style={styles.closeButtonTextSmall}>✕ Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <FlatList
            data={filteredHomeVideos}
            keyExtractor={(item) => item.videoId}
            ListHeaderComponent={ListHeader}
            showsVerticalScrollIndicator={false}
            renderItem={renderHomeItem}
            ListEmptyComponent={
              loading ? <ActivityIndicator size="large" color="#FF0000" style={{ marginTop: 40 }} />
              : <Text style={styles.emptyText}>No videos available. Ask your parent to approve a channel!</Text>
            }
          />
        </View>
      ) : renderShortsTab()}

      <View style={[styles.bottomNav, currentTab === 'Shorts' && styles.bottomNavDark]}>
        <TouchableOpacity style={styles.navItem} onPress={() => { setCurrentTab('Home'); setPlayingShortId(null); }}>
          <Text style={[styles.navIcon, currentTab === 'Home' && styles.navActive]}>🏠</Text>
          <Text style={[styles.navLabel, currentTab === 'Shorts' && { color: '#FFF' }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={handleShortsTab}>
          <Text style={[styles.navIcon, currentTab === 'Shorts' && styles.navActive]}>⚡</Text>
          <Text style={[styles.navLabel, currentTab === 'Shorts' && { color: '#FFF' }]}>Shorts</Text>
        </TouchableOpacity>
        <View style={[styles.navItemPlus, currentTab === 'Shorts' && { borderColor: '#FFF' }]}>
          <Text style={[styles.navPlusIcon, currentTab === 'Shorts' && { color: '#FFF' }]}>+</Text>
        </View>
        <View style={styles.navItem}>
          <Text style={styles.navIcon}>📺</Text>
          <Text style={[styles.navLabel, currentTab === 'Shorts' && { color: '#FFF' }]}>Subs</Text>
        </View>
        <View style={styles.navItem}>
          <Text style={styles.navIcon}>📁</Text>
          <Text style={[styles.navLabel, currentTab === 'Shorts' && { color: '#FFF' }]}>Library</Text>
        </View>
      </View>

      {showTollbooth && <MathTollbooth onSuccess={handleTollboothSuccess} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'android' ? 30 : 0 },
  loginContainer: { flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loginCard: { backgroundColor: '#FFF', padding: 30, borderRadius: 16, width: '100%', maxWidth: 400, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  loginSubtitle: { textAlign: 'center', color: '#6B7280', marginBottom: 24, marginTop: 8 },
  errorText: { color: '#DC2626', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8, marginBottom: 16, textAlign: 'center' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 16 },
  loginBtn: { backgroundColor: '#EF4444', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  loginBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  
  // Profile Selector
  profileContainer: { flex: 1, backgroundColor: '#0F0F0F', paddingTop: Platform.OS === 'android' ? 40 : 20 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  profileTitle: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  logoutText: { color: '#AAAAAA', fontSize: 16 },
  profilesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20, marginTop: 40 },
  profileCard: { alignItems: 'center', margin: 10 },
  profileAvatar: { width: 100, height: 100, borderRadius: 16, backgroundColor: '#272727', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  profileAvatarText: { fontSize: 48 },
  profileName: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  
  // Sleep Mode
  sleepContainer: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sleepIcon: { fontSize: 80, marginBottom: 20 },
  sleepTitle: { fontSize: 32, fontWeight: 'bold', color: '#F3F4F6', marginBottom: 10 },
  sleepSubtitle: { fontSize: 16, color: '#9CA3AF', textAlign: 'center', marginBottom: 40, paddingHorizontal: 20 },
  switchProfileBtn: { backgroundColor: '#374151', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30 },
  switchProfileText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  headerSection: { backgroundColor: '#FFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  youtubeIcon: { width: 28, height: 20, backgroundColor: '#FF0000', borderRadius: 5, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  playTriangle: { width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderLeftWidth: 6, borderBottomWidth: 4, borderTopWidth: 4, borderLeftColor: '#FFFFFF', borderRightColor: 'transparent', borderBottomColor: 'transparent', borderTopColor: 'transparent', marginLeft: 2 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0F0F0F', letterSpacing: -0.8 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  starBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  starBadgeText: { color: '#D97706', fontWeight: 'bold', fontSize: 14 },
  categoriesWrapper: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  categoriesContainer: { paddingHorizontal: 12, gap: 8 },
  categoryPill: { backgroundColor: '#F2F2F2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  categoryPillActive: { backgroundColor: '#0F0F0F' },
  categoryText: { color: '#0F0F0F', fontSize: 14, fontWeight: '500' },
  categoryTextActive: { color: '#FFFFFF' },
  playerSectionPinned: { backgroundColor: '#000', width: '100%', elevation: 5, zIndex: 10, shadowColor: '#000', shadowOffset: {width:0, height:4}, shadowOpacity: 0.1, shadowRadius: 4 },
  playerInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  nowPlayingText: { fontSize: 16, fontWeight: '700', color: '#0F0F0F' },
  closeButtonSmall: { backgroundColor: '#F2F2F2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  closeButtonTextSmall: { color: '#0F0F0F', fontSize: 13, fontWeight: '600' },
  videoCard: { marginBottom: 16 },
  thumbnail: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#E5E5E5' },
  durationBadge: { position: 'absolute', bottom: 70, right: 8, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  durationText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  videoDetailsContainer: { flexDirection: 'row', padding: 12, paddingRight: 8 },
  channelAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12, marginTop: 2 },
  videoTextContainer: { flex: 1, paddingRight: 12 },
  videoTitle: { fontSize: 16, fontWeight: '500', color: '#0F0F0F', lineHeight: 22, marginBottom: 4 },
  videoSubtitle: { fontSize: 12, color: '#606060' },
  menuDots: { width: 20, alignItems: 'center', paddingTop: 4, gap: 3 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#0F0F0F' },
  emptyText: { padding: 40, textAlign: 'center', color: '#606060' },
  
  shortsContainer: { flex: 1, backgroundColor: '#0F0F0F' },
  shortsHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#0F0F0F' },
  shortsHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  shortsEmptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  shortsEmptyIcon: { fontSize: 48, marginBottom: 16 },
  shortsEmptyTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  shortsEmptySubtitle: { fontSize: 14, color: '#AAAAAA', textAlign: 'center', lineHeight: 22 },
  shortCard: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 190, backgroundColor: '#000', overflow: 'hidden', justifyContent: 'center' },
  shortPlayerWrapper: { width: '100%', justifyContent: 'center', alignItems: 'center' },
  shortPlayButton: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  shortPlayIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  shortPlayTriangle: { width: 0, height: 0, borderStyle: 'solid', borderLeftWidth: 20, borderBottomWidth: 14, borderTopWidth: 14, borderLeftColor: '#FFFFFF', borderRightColor: 'transparent', borderBottomColor: 'transparent', borderTopColor: 'transparent', marginLeft: 6 },
  shortOverlay: { position: 'absolute', bottom: 16, left: 14, right: 70 },
  shortTitle: { color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 10, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width:1,height:1}, textShadowRadius: 4, lineHeight: 20 },
  shortChannelRow: { flexDirection: 'row', alignItems: 'center' },
  shortChannelAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  shortSubtitle: { color: '#FFF', fontSize: 13, fontWeight: '500' },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 30, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E5E5' },
  bottomNavDark: { backgroundColor: '#0F0F0F', borderTopColor: '#272727' },
  navItem: { alignItems: 'center' },
  navIcon: { fontSize: 20, marginBottom: 4, opacity: 0.5 },
  navActive: { opacity: 1 },
  navLabel: { fontSize: 10, color: '#0F0F0F' },
  navItemPlus: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#0F0F0F', justifyContent: 'center', alignItems: 'center' },
  navPlusIcon: { fontSize: 24, fontWeight: '300', color: '#0F0F0F', marginTop: -2 }
});
