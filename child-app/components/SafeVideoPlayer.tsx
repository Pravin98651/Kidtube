import React, { useState, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

interface SafeVideoPlayerProps {
  videoId: string;
  autoplay?: boolean;
  vertical?: boolean;
}

export default function SafeVideoPlayer({ videoId, autoplay = true, vertical = false }: SafeVideoPlayerProps) {
  const [playing, setPlaying] = useState(autoplay);
  const [ended, setEnded] = useState(false);
  const { width, height } = useWindowDimensions();

  const onStateChange = useCallback((state: string) => {
    if (state === 'ended') {
      setPlaying(false);
      setEnded(true);
    }
    if (state === 'playing') {
      setEnded(false);
    }
  }, []);

  let playerWidth: number;
  let playerHeight: number;

  if (vertical) {
    playerWidth = Platform.OS === 'web' ? Math.min(width, 500) : width;
    playerHeight = Math.round(height * 0.7);
  } else {
    playerWidth = Platform.OS === 'web' ? Math.min(width, 800) : width;
    playerHeight = Math.round((playerWidth * 9) / 16);
  }

  return (
    <View style={[styles.container, { width: playerWidth, height: playerHeight }]}>
      <YoutubePlayer
        height={playerHeight}
        width={playerWidth}
        play={playing}
        videoId={videoId}
        onChangeState={onStateChange}
        initialPlayerParams={{
          rel: false,
          modestbranding: true,
          fs: false,
          iv_load_policy: 3,
          controls: vertical ? false : true,
        }}
      />

      {/* ===== TOUCH BLOCKERS ===== 
       *
       *  Player layout (what YouTube shows):
       *  ┌─────────────────────────────────┐
       *  │ [Title]    [Share] [Watch on YT] │  ← TOP BAR (blocked)
       *  │                                  │
       *  │         (video content)          │  ← open for tap-to-pause
       *  │                                  │
       *  │              ┌──────────┐        │
       *  │              │ RECOMMEND │        │  ← BOTTOM-RIGHT (blocked)
       *  │              └──────────┘        │
       *  │ [▶ 0:36/10:09]    [⚙] [YouTube] │  ← CONTROLS BAR
       *  └─────────────────────────────────┘
       *
       *  We block: top bar, bottom-right half (recommendations + YT logo)
       *  We allow: center (play/pause tap), bottom-left (timeline, settings)
       */}

      {/* TOP BAR — blocks title link, Share, Watch on YouTube */}
      <View style={[styles.touchBlocker, { top: 0, left: 0, right: 0, height: 52 }]} />

      {/* BOTTOM-RIGHT ZONE — blocks the recommendation card AND the 
          YouTube watermark. Covers the right 55% of the bottom 40% of the player.
          This leaves the play/pause button and timeline on the left side accessible. */}
      <View style={[styles.touchBlocker, { 
        bottom: 0, 
        right: 0, 
        width: Math.round(playerWidth * 0.55),
        height: Math.round(playerHeight * 0.40),
      }]} />

      {/* END SCREEN BLOCKER — full overlay when video finishes to block 
          all recommendation thumbnails that YouTube shows */}
      {ended && (
        <View style={styles.endScreenBlocker}>
          <View style={styles.replayBadge}>
            <View style={styles.replayIcon} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
    alignSelf: 'center',
    position: 'relative',
  },
  touchBlocker: {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  endScreenBlocker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replayBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  replayIcon: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 18,
    borderBottomWidth: 12,
    borderTopWidth: 12,
    borderLeftColor: '#FFFFFF',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderTopColor: 'transparent',
    marginLeft: 5,
  },
});
