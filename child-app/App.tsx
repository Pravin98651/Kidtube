import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Image, Platform, ActivityIndicator, FlatList, Dimensions, TextInput, KeyboardAvoidingView } from 'react-native';
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

// Memoized Shorts Card (Full Screen vertical scroll)
const ShortCard = memo(({ video, isActive }: { video: Video, isActive: boolean }) => {
  return (
    <View style={styles.shortContainer}>
      {isActive ? (
        <View style={styles.shortPlayerWrapper}>
          <SafeVideoPlayer videoId={video.videoId} />
        </View>
      ) : (
        <Image source={{ uri: getThumbnailUrl(video) }} style={styles.shortThumbnail} resizeMode="cover" />
      )}
      <View style={styles.shortOverlay}>
        <Text style={styles.shortTitle} numberOfLines={2}>{video.title}</Text>
        <Text style={styles.shortSubtitle}>{video.channelTitle}</Text>
      </View>
    </View>
  );
});
ShortCard.displayName = 'ShortCard';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentTab, setCurrentTab] = useState<'Home' | 'Shorts'>('Home');
  const [activeShortIndex, setActiveShortIndex] = useState(0);
  
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(false);

  // Using the new ultra-stable auto-restarting tunnel!
  const baseUrl = Platform.OS === 'web' || Platform.OS === 'ios' ? 'http://localhost:8080' : 'https://kidtube-backend-stable.loca.lt';

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
          fetch(`${baseUrl}/api/videos`, { headers: { 'Authorization': `Bearer ${token}`, 'Bypass-Tunnel-Reminder': 'true' } }),
          fetch(`${baseUrl}/api/channels`, { headers: { 'Authorization': `Bearer ${token}`, 'Bypass-Tunnel-Reminder': 'true' } })
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
        headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
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

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveShortIndex(viewableItems[0].index);
    }
  }, []);

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
      {activeVideo && (
        <View style={styles.playerSection}>
          <SafeVideoPlayer videoId={activeVideo} />
          <TouchableOpacity style={styles.closeButton} onPress={() => setActiveVideo(null)}>
            <Text style={styles.closeButtonText}>Close Video</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {currentTab === 'Home' ? (
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
      ) : (
        <View style={styles.shortsContainer}>
          <FlatList
            data={shortsVideos}
            keyExtractor={(item) => item.videoId}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
            renderItem={({ item, index }) => (
              <ShortCard video={item} isActive={index === activeShortIndex} />
            )}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: '#FFF' }]}>No Shorts available.</Text>
            }
          />
        </View>
      )}

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentTab('Home')}>
          <Text style={[styles.navIcon, currentTab === 'Home' && styles.navActive]}>🏠</Text>
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentTab('Shorts')}>
          <Text style={[styles.navIcon, currentTab === 'Shorts' && styles.navActive]}>⚡</Text>
          <Text style={styles.navLabel}>Shorts</Text>
        </TouchableOpacity>
        <View style={styles.navItemPlus}><Text style={styles.navPlusIcon}>+</Text></View>
        <View style={styles.navItem}><Text style={styles.navIcon}>📺</Text><Text style={styles.navLabel}>Subs</Text></View>
        <View style={styles.navItem}><Text style={styles.navIcon}>📁</Text><Text style={styles.navLabel}>Library</Text></View>
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
  playerSection: { backgroundColor: '#000', width: '100%' },
  closeButton: { padding: 12, alignItems: 'center', backgroundColor: '#222' },
  closeButtonText: { color: '#FFF', fontWeight: '600' },
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
  shortsContainer: { flex: 1, backgroundColor: '#000' },
  shortContainer: { height: SCREEN_HEIGHT - 60, width: SCREEN_WIDTH, justifyContent: 'center', backgroundColor: '#111' },
  shortPlayerWrapper: { width: '100%', height: '100%', justifyContent: 'center' },
  shortThumbnail: { width: '100%', height: '100%', opacity: 0.5 },
  shortOverlay: { position: 'absolute', bottom: 100, left: 16, right: 16 },
  shortTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width:1,height:1}, textShadowRadius: 3 },
  shortSubtitle: { color: '#FFF', fontSize: 14, opacity: 0.8 },

  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 8, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E5E5' },
  navItem: { alignItems: 'center' },
  navIcon: { fontSize: 20, marginBottom: 4, opacity: 0.5 },
  navActive: { opacity: 1 },
  navLabel: { fontSize: 10, color: '#0F0F0F' },
  navItemPlus: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#0F0F0F', justifyContent: 'center', alignItems: 'center' },
  navPlusIcon: { fontSize: 24, fontWeight: '300', color: '#0F0F0F', marginTop: -2 }
});
