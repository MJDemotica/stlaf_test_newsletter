import axios from 'axios';

export default async function handler(req, res) {
  const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const PAGE_ID = process.env.FACEBOOK_PAGE_ID;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!PAGE_ACCESS_TOKEN || !PAGE_ID) {
    return res.status(200).json({
      success: false,
      error: 'Facebook credentials not configured.',
    });
  }

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v19.0/${PAGE_ID.trim()}`,
      {
        params: {
          fields:
            'name,link,picture,about,instagram_business_account{id,username,name,profile_picture_url}',
          access_token: PAGE_ACCESS_TOKEN.trim(),
        },
      }
    );

    return res.status(200).json({ success: true, pageInfo: response.data });
  } catch (error) {
    const errorData = error.response?.data?.error || {};
    console.error('Facebook Page Info Error:', JSON.stringify(errorData, null, 2));

    return res.status(error.response?.status || 500).json({
      success: false,
      error: errorData.message || 'Failed to fetch Facebook Page info',
    });
  }
}