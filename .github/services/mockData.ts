import { Post, FacebookPage } from '../types';

export const MOCK_USER_OLD = {
  name: "Alex Doe (Old)",
  avatar: "https://picsum.photos/id/64/100/100",
  handle: "@alex_doe_legacy"
};

export const MOCK_USER_NEW = {
  name: "Alex Doe (New)",
  avatar: "https://picsum.photos/id/65/100/100",
  handle: "@alex_doe_official"
};

export const MOCK_MANAGED_PAGES: FacebookPage[] = [
  {
    id: 'page_demo_1',
    name: "Alex's Photography Studio",
    access_token: 'mock_token_1',
    picture: {
      data: { url: "https://picsum.photos/id/250/100/100" }
    }
  },
  {
    id: 'page_demo_2',
    name: "Vintage Car Enthusiasts",
    access_token: 'mock_token_2',
    picture: {
      data: { url: "https://picsum.photos/id/111/100/100" }
    }
  },
  {
    id: 'page_demo_3',
    name: "Downtown Foodie Reviews",
    access_token: 'mock_token_3',
    picture: {
      data: { url: "https://picsum.photos/id/292/100/100" }
    }
  }
];

export const MOCK_POSTS: Post[] = [
  {
    id: 'p1',
    content: "Just got tickets to the Rolling Stones concert! So excited! 🎸 #classic",
    date: "2019-05-12",
    likes: 45,
    originalAuthor: "Alex Doe",
    imageUrl: "https://picsum.photos/id/145/400/300"
  },
  {
    id: 'p2',
    content: "Delicious sushi for lunch today at the new downtown spot. 🍣",
    date: "2019-06-01",
    likes: 12,
    originalAuthor: "Alex Doe"
  },
  {
    id: 'p3',
    content: "The acoustic set at the local cafe was surprisingly good last night.",
    date: "2019-07-20",
    likes: 23,
    originalAuthor: "Alex Doe"
  },
  {
    id: 'p4',
    content: "Hiking up Mt. Rainier. The view is breathtaking! 🏔️",
    date: "2019-08-15",
    likes: 89,
    originalAuthor: "Alex Doe",
    imageUrl: "https://picsum.photos/id/1018/400/300"
  },
  {
    id: 'p5',
    content: "Anyone selling tickets to the EDM festival next weekend? DM me!",
    date: "2019-09-02",
    likes: 5,
    originalAuthor: "Alex Doe"
  },
  {
    id: 'p6',
    content: "My cat just knocked over my coffee. Happy Monday. 🐈",
    date: "2019-10-10",
    likes: 150,
    originalAuthor: "Alex Doe"
  },
  {
    id: 'p7',
    content: "Throwback to that insane mosh pit at the metal gig. My ears are still ringing.",
    date: "2020-01-15",
    likes: 67,
    originalAuthor: "Alex Doe",
    imageUrl: "https://picsum.photos/id/452/400/300"
  },
  {
    id: 'p8',
    content: "Coding all night long. React is fun but tiring.",
    date: "2020-03-01",
    likes: 42,
    originalAuthor: "Alex Doe"
  },
  {
    id: 'p9',
    content: "Live music is finally back! Heading to the Jazz club tonight.",
    date: "2021-06-15",
    likes: 55,
    originalAuthor: "Alex Doe"
  },
  {
    id: 'p10',
    content: "Just booked my flight to Tokyo! ✈️",
    date: "2022-11-20",
    likes: 112,
    originalAuthor: "Alex Doe"
  }
];