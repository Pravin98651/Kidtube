import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Image, Platform, ActivityIndicator, FlatList, Dimensions, TextInput, KeyboardAvoidingView, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SafeVideoPlayer from './components/SafeVideoPlayer';
import { useState, useEffect, memo, useCallback } from 'react';

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

  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentTab, setCurrentTab] = useState<'Home' | 'Shorts'>('Home');
  // Track which short is currently playing
  const [playingShortId, setPlayingShortId] = useState<string | null>(null);
  
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(false);

  const baseUrl = 'https://kidtube-almy.onrender.com';

  useEffect(() => {
    const checkToken = async () => {
      const storedToken = await AsyncStorage.getItem('kidtube_token');
      if (storedToken) {
        setToken(storedToken);
      }
    };
    checkToken();
  }, []);

  useEffect(() => {
    if (!token) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const [vidRes, chanRes] = await Promise.all([
          fetch(`${baseUrl}/api/videos`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${baseUrl}/api/channels`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (vidRes.ok && chanRes.ok) {
          const vids = await vidRes.json();
          const chans = await chanRes.json();
          setVideos(vids);
          const uniqueChannelTitles = Array.from(new Set(vids.map((v: Video) => v.channelTitle)));
          setCategories(['All', ...uniqueChannelTitles] as string[]);
        } else if (vidRes.status === 401) {
          handleLogout();
        }
      } catch (e) {
        console.error('Failed to fetch data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

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
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('kidtube_token');
    setToken(null);
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
          
          <TextInput
            style={styles.input}
            placeholder="Parent Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Device Password (Set in Dashboard)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={isLoggingIn}>
            <Text style={styles.loginBtnText}>{isLoggingIn ? 'Logging in...' : 'Link Device'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Filter Logic
  const shortsVideos = videos.filter(v => v.duration && v.duration <= 61);
  const regularVideos = videos.filter(v => !v.duration || v.duration > 61);
  
  const filteredHomeVideos = selectedCategory === 'All' 
    ? regularVideos 
    : regularVideos.filter(v => v.channelTitle === selectedCategory);

  // Auto-play first short when switching to Shorts tab
  const handleShortsTab = () => {
    setCurrentTab('Shorts');
    if (shortsVideos.length > 0 && !playingShortId) {
      setPlayingShortId(shortsVideos[0].videoId);
    }
  };

  const ListHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.youtubeIcon}><View style={styles.playTriangle} /></View>
          <Text style={styles.headerTitle}>YouTube</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={handleLogout}><Text style={{fontSize: 24}}>🚪</Text></TouchableOpacity>
        </View>
      </View>
      <View style={styles.categoriesWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.categoryPill, selectedCategory === item && styles.categoryPillActive]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text style={[styles.categoryText, selectedCategory === item && styles.categoryTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.categoriesContainer}
        />
      </View>
    </View>
  );

  // ===== SHORTS TAB =====
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
            <Text style={styles.shortsEmptySubtitle}>
              Shorts from your approved channels will appear here.{'\n'}
              Make sure "Disable Shorts" is turned off in the Parent Dashboard.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.shortsContainer}>
        {/* Shorts Header */}
        <View style={styles.shortsHeader}>
          <View style={styles.youtubeIcon}><View style={styles.playTriangle} /></View>
          <Text style={styles.shortsHeaderTitle}>Shorts</Text>
        </View>

        {/* Vertical scrolling shorts feed */}
        <ScrollView
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={SCREEN_HEIGHT - 190}
          snapToAlignment="start"
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.y / (SCREEN_HEIGHT - 190));
            const safeIndex = Math.min(index, shortsVideos.length - 1);
            if (safeIndex >= 0 && shortsVideos[safeIndex]) {
              setPlayingShortId(shortsVideos[safeIndex].videoId);
            }
          }}
        >
          {shortsVideos.map((video) => (
            <View key={video.videoId} style={styles.shortCard}>
              {/* Background thumbnail (always visible behind player) */}
              <Image 
                source={{ uri: getThumbnailUrl(video) }} 
                style={StyleSheet.absoluteFill} 
                resizeMode="cover"
                blurRadius={3}
              />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />

              {/* Video Player (only for the active short) */}
              {playingShortId === video.videoId ? (
                <View style={styles.shortPlayerWrapper}>
                  <SafeVideoPlayer videoId={video.videoId} vertical={true} />
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.shortPlayButton}
                  onPress={() => setPlayingShortId(video.videoId)}
                  activeOpacity={0.8}
                >
                  <View style={styles.shortPlayIcon}>
                    <View style={styles.shortPlayTriangle} />
                  </View>
                </TouchableOpacity>
              )}

              {/* Video info overlay */}
              <View style={styles.shortOverlay}>
                <Text style={styles.shortTitle} numberOfLines={2}>{video.title}</Text>
                <View style={styles.shortChannelRow}>
                  <Image 
                    source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(video.channelTitle)}&background=random&color=fff&rounded=true&size=32` }} 
                    style={styles.shortChannelAvatar} 
                  />
                  <Text style={styles.shortSubtitle}>{video.channelTitle}</Text>
                </View>
              </View>

              {/* Right side actions */}
              <View style={styles.shortActions}>
                <View style={styles.shortActionItem}>
                  <Text style={styles.shortActionIcon}>👍</Text>
                  <Text style={styles.shortActionLabel}>Like</Text>
                </View>
                <View style={styles.shortActionItem}>
                  <Text style={styles.shortActionIcon}>👎</Text>
                  <Text style={styles.shortActionLabel}>Dislike</Text>
                </View>
                <View style={styles.shortActionItem}>
                  <Text style={styles.shortActionIcon}>💬</Text>
                  <Text style={styles.shortActionLabel}>Chat</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
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
            renderItem={({ item }) => (
              <VideoCard video={item} onPress={() => setActiveVideo(item.videoId)} />
            )}
            ListEmptyComponent={
              loading ? <ActivityIndicator size="large" color="#FF0000" style={{ marginTop: 40 }} />
              : <Text style={styles.emptyText}>No videos available. Ask your parent to approve a channel!</Text>
            }
          />
        </View>
      ) : (
        renderShortsTab()
      )}

      {/* Bottom Nav */}
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
  headerSection: { backgroundColor: '#FFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  youtubeIcon: { width: 28, height: 20, backgroundColor: '#FF0000', borderRadius: 5, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  playTriangle: { width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderLeftWidth: 6, borderBottomWidth: 4, borderTopWidth: 4, borderLeftColor: '#FFFFFF', borderRightColor: 'transparent', borderBottomColor: 'transparent', borderTopColor: 'transparent', marginLeft: 2 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0F0F0F', letterSpacing: -0.8 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
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
  
  // Shorts Styles
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
  shortActions: { position: 'absolute', right: 10, bottom: 80, alignItems: 'center', gap: 20 },
  shortActionItem: { alignItems: 'center' },
  shortActionIcon: { fontSize: 24, marginBottom: 2 },
  shortActionLabel: { color: '#FFF', fontSize: 10, fontWeight: '500' },

  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 30, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E5E5' },
  bottomNavDark: { backgroundColor: '#0F0F0F', borderTopColor: '#272727' },
  navItem: { alignItems: 'center' },
  navIcon: { fontSize: 20, marginBottom: 4, opacity: 0.5 },
  navActive: { opacity: 1 },
  navLabel: { fontSize: 10, color: '#0F0F0F' },
  navItemPlus: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#0F0F0F', justifyContent: 'center', alignItems: 'center' },
  navPlusIcon: { fontSize: 24, fontWeight: '300', color: '#0F0F0F', marginTop: -2 }
});
