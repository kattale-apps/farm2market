const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');

// Initialize Firebase Admin (will use service account from environment)
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;
  
  // Get service account from environment variable
  const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT;
  
  if (!serviceAccountJson) {
    throw new Error('FCM_SERVICE_ACCOUNT environment variable not set');
  }
  
  const serviceAccount = JSON.parse(serviceAccountJson);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  
  firebaseInitialized = true;
}

/**
 * HTTP Cloud Function to send FCM push notifications
 * 
 * Expected request body:
 * {
 *   "tokens": ["token1", "token2", ...],
 *   "title": "Notification Title",
 *   "body": "Notification Body",
 *   "data": { ...optional data... }
 * }
 */
functions.http('sendFCMNotification', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  try {
    // Initialize Firebase Admin
    initializeFirebase();
    
    const { tokens, title, body, data } = req.body;
    
    // Validate input
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      res.status(400).json({ error: 'tokens array is required and must not be empty' });
      return;
    }
    
    if (!title || !body) {
      res.status(400).json({ error: 'title and body are required' });
      return;
    }
    
    // Send notifications to all tokens
    const messages = tokens.map(token => ({
      token: token,
      notification: {
        title: title,
        body: body,
      },
      data: data ? Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, String(value)])
      ) : {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
    }));
    
    // Use Firebase Admin SDK to send messages
    const response = await admin.messaging().sendEach(messages);
    
    // Count successes and failures
    const results = {
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses.map((resp, idx) => ({
        token: tokens[idx],
        success: resp.success,
        error: resp.error ? {
          code: resp.error.code,
          message: resp.error.message,
        } : null,
      })),
    };
    
    res.status(200).json({
      success: true,
      ...results,
    });
    
  } catch (error) {
    console.error('Error sending FCM notification:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});
