const { google } = require('googleapis');
require('dotenv').config();


const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

/**
 * Resolves a YouTube channel handle or ID to a canonical Channel ID.
 */
async function resolveChannelId(query) {
  try {
    // If it's a handle (starts with @)
    if (query.startsWith('@')) {
      const response = await youtube.search.list({
        part: 'snippet',
        q: query,
        type: 'channel',
        maxResults: 1
      });
      if (response.data.items && response.data.items.length > 0) {
        return response.data.items[0].snippet.channelId;
      }
      return null;
    }

    // Direct channel ID check
    const response = await youtube.channels.list({
      part: 'id,snippet',
      id: query
    });
    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0].id;
    }
    return null;
  } catch (error) {
    console.error('Error resolving channel ID:', error);
    throw error;
  }
}

/**
 * Fetches recent video IDs from a channel's uploads playlist.
 */
async function fetchChannelVideos(channelId, maxResults = 50) {
  try {
    // First get the 'uploads' playlist ID for the channel
    const channelRes = await youtube.channels.list({
      part: 'contentDetails',
      id: channelId
    });

    if (!channelRes.data.items || channelRes.data.items.length === 0) {
      return [];
    }

    const uploadsPlaylistId = channelRes.data.items[0].contentDetails.relatedPlaylists.uploads;

    // Fetch videos from the playlist
    const playlistRes = await youtube.playlistItems.list({
      part: 'snippet',
      playlistId: uploadsPlaylistId,
      maxResults: maxResults
    });

    return playlistRes.data.items.map(item => item.snippet.resourceId.videoId);
  } catch (error) {
    console.error('Error fetching channel videos:', error);
    throw error;
  }
}

/**
 * Parses ISO 8601 duration (e.g. PT1M2S) to seconds.
 */
function parseDurationToSeconds(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;
  const hours = (parseInt(match[1]) || 0);
  const minutes = (parseInt(match[2]) || 0);
  const seconds = (parseInt(match[3]) || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Fetches video details and filters out Shorts based on KidTube logic.
 * Layer 1: Duration <= 61s (if disableShorts is true)
 * Layer 3: Tags / Title containing #shorts
 */
async function filterAndGetVideos(videoIds, disableShorts = true, blockedCategoryIds = [], blockedKeywords = []) {
  if (!videoIds || videoIds.length === 0) return [];



  try {
    const res = await youtube.videos.list({
      part: 'snippet,contentDetails',
      id: videoIds.join(',')
    });

    const candidateVideos = [];

    for (const video of res.data.items) {
      const categoryId = video.snippet.categoryId;
      const durationStr = video.contentDetails.duration;
      const durationSecs = parseDurationToSeconds(durationStr);
      
      const title = (video.snippet.title || '').toLowerCase();
      const description = (video.snippet.description || '').toLowerCase();
      const tags = (video.snippet.tags || []).map(t => t.toLowerCase());

      const isShortDuration = durationSecs <= 61;
      const hasShortsTag = tags.includes('#shorts') || tags.includes('shorts') || tags.includes('#short');
      const hasShortsInTitleDesc = title.includes('#shorts') || description.includes('#shorts');
      const isBlockedCategory = blockedCategoryIds.includes(categoryId);
      
      const containsBlockedKeyword = blockedKeywords.some(kw => 
        title.includes(kw.toLowerCase()) || description.includes(kw.toLowerCase())
      );

      // If any shorts criteria met (and disableShorts is true), category is blocked, or keyword matches, skip it
      if ((disableShorts && (isShortDuration || hasShortsTag || hasShortsInTitleDesc)) || isBlockedCategory || containsBlockedKeyword) {
        continue;
      }
      
      candidateVideos.push(video);
    }

    // --- FORMAT APPROVED VIDEOS ---
    const approvedVideos = candidateVideos.map(video => ({
      videoId: video.id || '',
      title: video.snippet.title || '',
      description: video.snippet.description || '',
      thumbnails: video.snippet.thumbnails || {},
      channelId: video.snippet.channelId || '',
      channelTitle: video.snippet.channelTitle || 'Unknown Channel',
      categoryId: video.snippet.categoryId || '',
      duration: parseDurationToSeconds(video.contentDetails.duration) || 0,
      publishedAt: video.snippet.publishedAt || new Date().toISOString()
    }));

    return approvedVideos;
  } catch (error) {
    console.error('Error fetching video details:', error);
    throw error;
  }
}

module.exports = {
  resolveChannelId,
  fetchChannelVideos,
  filterAndGetVideos
};
