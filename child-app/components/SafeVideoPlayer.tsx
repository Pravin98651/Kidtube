import React, { useState, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

interface SafeVideoPlayerProps {
  videoId: string;
}

export default function SafeVideoPlayer({ videoId }: SafeVideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const { width } = useWindowDimensions();

  const onStateChange = useCallback((state: string) => {
    if (state === 'ended') {
      setPlaying(false);
    }
  }, []);

  // Ensure max width for web so it doesn't get ridiculously tall on desktop monitors
  const playerWidth = Platform.OS === 'web' ? Math.min(width, 800) : width;
  const playerHeight = Math.round((playerWidth * 9) / 16);

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
          controls: true,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
    alignSelf: 'center', // Centers the player if bounded by max width
  },
});
