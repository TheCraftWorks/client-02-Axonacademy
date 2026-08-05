const WEBEX_API_URL = 'https://webexapis.com/v1';

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get a fresh Webex Access Token using the Refresh Token (OAuth 2.0 flow)
 */
async function getAccessToken() {
  const now = Date.now();
  
  // Use cached token if valid for at least another minute
  if (cachedToken && tokenExpiry > now + 60000) {
    return cachedToken;
  }

  const clientId = process.env.WEBEX_CLIENT_ID;
  const clientSecret = process.env.WEBEX_CLIENT_SECRET;
  const refreshToken = process.env.WEBEX_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    // Fallback to static token if provided
    if (process.env.WEBEX_ACCESS_TOKEN) return process.env.WEBEX_ACCESS_TOKEN;
    throw new Error('Webex Credentials (CLIENT_ID, CLIENT_SECRET, or REFRESH_TOKEN) are not configured in .env');
  }

  console.log('[Webex Service] Refreshing access token using Refresh Token...');

  const response = await fetch(`${WEBEX_API_URL}/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Webex Token Refresh Error]', data);
    throw new Error(data.message || 'Failed to refresh Webex Access Token');
  }

  cachedToken = data.access_token;
  tokenExpiry = now + (data.expires_in * 1000);
  
  console.log('[Webex Service] Token refreshed successfully.');
  return cachedToken;
}

/**
 * Create a Webex meeting
 * @param {Object} meetingData
 * @param {string} meetingData.title
 * @param {Date} meetingData.start
 * @param {number} meetingData.duration (in minutes)
 * @returns {Promise<Object>} The created meeting object from Webex
 */
exports.createWebexMeeting = async ({ title, start, duration }) => {
  const token = await getAccessToken();

  let startTime = new Date(start);
  const now = new Date();

  // Webex rejects meetings starting in the past. 
  if (startTime.getTime() < now.getTime() + 120000) {
    startTime = new Date(now.getTime() + 120000);
  }

  const endTime = new Date(startTime.getTime() + duration * 60000);

  console.log(`[Webex Service] Creating meeting: "${title}" from ${startTime.toISOString()} to ${endTime.toISOString()}`);

  const response = await fetch(`${WEBEX_API_URL}/meetings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      allowAnyUserToBeHost: true
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Webex Service Error]', data);
    if (data.message && data.message.includes('scopes')) {
      throw new Error('Webex App is missing Meeting Scopes. Please update your Webex Integration to include "meetings:write" and "meetings:read", then regenerate the refresh token.');
    }
    throw new Error(data.message || 'Failed to create Webex meeting');
  }

  return {
    id: data.id,
    webLink: data.webLink,
    password: data.password
  };
};

/**
 * Delete a Webex meeting
 * @param {string} meetingId
 */
exports.deleteWebexMeeting = async (meetingId) => {
  try {
    const token = await getAccessToken();
    
    const response = await fetch(`${WEBEX_API_URL}/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('[Webex Service Delete Error]', data);
    }
  } catch (error) {
    console.error('[Webex Service Delete Error]', error.message);
  }
};
