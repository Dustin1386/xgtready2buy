const API_KEY  = process.env.CLUBREADY_API_KEY;
const STORE_ID = process.env.CLUBREADY_STORE_ID;
const BASE_URL = 'https://clubready.com/api/current';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { userId } = JSON.parse(event.body || '{}');
  if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'userId required' }) };

  try {
    const params = new URLSearchParams({
      ApiKey:      API_KEY,
      OwnerId:     userId,
      OwnerType:   'User',
      CreatorId:   userId,
      CreatorType: 'User',
      Page:        'AddCard',
      StoreId:     STORE_ID,
    });

    const res  = await fetch(`${BASE_URL}/sales/wallet/wallettokencreate?${params}`);
    const data = await res.json();

    if (!data.success || !data.walletUrl || !data.walletToken) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: data.message || 'Could not create wallet token' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ walletUrl: data.walletUrl, walletToken: data.walletToken }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
