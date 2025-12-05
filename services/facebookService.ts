import { Post, UserProfile } from '../types';

export const fetchFacebookProfile = async (accessToken: string): Promise<UserProfile> => {
  const response = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,picture.type(large)&access_token=${accessToken}`);
  if (!response.ok) {
    throw new Error('Failed to fetch profile');
  }
  const data = await response.json();
  return {
    name: data.name,
    handle: '@' + data.name.replace(/\s+/g, '').toLowerCase(),
    avatar: data.picture?.data?.url || 'https://via.placeholder.com/100'
  };
};

export const fetchFacebookPosts = async (accessToken: string): Promise<Post[]> => {
  // Fetch user feed. Limit to 50 for this demo to ensure speed.
  const response = await fetch(
    `https://graph.facebook.com/v19.0/me/feed?fields=id,message,created_time,full_picture,likes.summary(true),from&limit=50&access_token=${accessToken}`
  );
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to fetch Facebook posts');
  }

  const data = await response.json();
  
  // Map Graph API response to our Post type
  return data.data
    .filter((item: any) => item.message) // Only keep posts that have text content
    .map((item: any) => ({
      id: item.id,
      content: item.message,
      date: new Date(item.created_time).toISOString().split('T')[0],
      likes: item.likes?.summary?.total_count || 0,
      imageUrl: item.full_picture,
      originalAuthor: item.from?.name || 'Me'
    }));
};