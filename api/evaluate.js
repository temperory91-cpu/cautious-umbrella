/**
 * Backend Proxy for Gemini API
 * This runs on Vercel's servers to bypass browser CORS restrictions 
 * and securely handle the API key.
 */
export default async function handler(req, res) {
  // Priority 1: Use environment variable if set on Vercel Dashboard
  // Priority 2: Use the hardcoded key provided in your query
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDbyGKXa88iiWJNn6cZAsTAM72PdnZTh-g";
  
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  // Only allow POST requests from your frontend
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: 'Gemini API Error', 
        details: errorText 
      });
    }

    const data = await response.json();
    
    // Return the AI response back to the browser
    res.status(200).json(data);
  } catch (error) {
    console.error("Backend Proxy Error:", error);
    res.status(500).json({ error: 'Failed to communicate with AI server' });
  }
}