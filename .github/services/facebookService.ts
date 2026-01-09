import { Post, UserProfile, FacebookPage } from '../types';

export const fetchFacebookProfile = async (accessToken: string): Promise<UserProfile> => {
  const response = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,picture.type(large)&access_token=${accessToken}`);
  if (!response.ok) {
    throw new Error('Failed to fetch profile');
  }
  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    handle: '@' + data.name.replace(/\s+/g, '').toLowerCase(),
    avatar: data.picture?.data?.url || 'https://via.placeholder.com/100'
  };
};

export const fetchManagedPages = async (userAccessToken: string): Promise<FacebookPage[]> => {
  const response = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture&access_token=${userAccessToken}`
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to fetch managed pages');
  }

  const data = await response.json();
  return data.data || [];
};

export const fetchFacebookPosts = async (accessToken: string, endpoint: string = 'me/feed'): Promise<Post[]> => {
  const response = await fetch(
    `https://graph.facebook.com/v19.0/${endpoint}?fields=id,message,story,created_time,full_picture,reactions.summary(true).limit(0),from&limit=50&access_token=${accessToken}`
  );
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error("FB API Error:", errorData);
    throw new Error(errorData.error?.message || 'Failed to fetch posts');
  }

  const data = await response.json();
  
  return (data.data || [])
    .filter((item: any) => item.message || item.story)
    .map((item: any) => ({
      id: item.id,
      content: item.message || item.story || "",
      date: new Date(item.created_time).toISOString().split('T')[0],
      likes: item.reactions?.summary?.total_count || 0,
      imageUrl: item.full_picture,
      originalAuthor: item.from?.name || 'Unknown'
    }));
};

/**
 * Publikuje post na ścianę strony (Page Feed).
 * Wymaga Page Access Token z uprawnieniem 'pages_manage_posts'.
 */
export const publishPostToPage = async (pageId: string, pageAccessToken: string, message: string, link?: string): Promise<string> => {
  const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
  
  const body: any = {
    message: message,
    access_token: pageAccessToken,
  };

  // Jeśli post zawiera obrazek z oryginalnego posta, dołączamy go jako link
  if (link) {
    body.link = link;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to publish post');
  }

  return data.id; // Zwraca ID nowo utworzonego posta
};