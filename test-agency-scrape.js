const axios = require('axios');
require('dotenv').config();

const PERPLEXITY_KEY = process.env.PERPLEXITY_KEY;

if (!PERPLEXITY_KEY) {
  console.error('PERPLEXITY_KEY not found in .env');
  process.exit(1);
}

async function testScrape() {
  const url = 'https://www.influencers.gg';
  
  console.log('[Test] Testing Perplexity API with URL:', url);
  console.log('[Test] Using API key:', PERPLEXITY_KEY.substring(0, 20) + '...');

  try {
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at extracting creator and influencer information from agency websites. Extract all roster information and return as valid JSON.'
          },
          {
            role: 'user',
            content: `Analyze this agency website and extract ALL creator/influencer roster information:

URL: ${url}

For each creator found, provide:
- handle: Their username/handle (without @ symbol)
- name: Real name if available
- platforms: Array of platforms (tiktok, youtube, instagram, twitch, etc)
- followerCount: Approximate followers if mentioned

Return ONLY a valid JSON array, no markdown, no code blocks. Example:
[
  {"handle":"username","name":"Real Name","platforms":["tiktok"],"followerCount":5000000},
  {"handle":"another","name":"Person","platforms":["youtube","instagram"],"followerCount":2000000}
]

If no creators found, return empty array: []`
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 2000
      },
      {
        headers: {
          Authorization: `Bearer ${PERPLEXITY_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('[Test] Response status:', response.status);
    console.log('[Test] Response data:', JSON.stringify(response.data, null, 2));

    // Try to extract creators
    const content = response.data.choices?.[0]?.message?.content || '';
    console.log('\n[Test] Content:', content);

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const creators = JSON.parse(jsonMatch[0]);
        console.log('\n[Test] Parsed creators:', creators);
        console.log('[Test] Success! Found', creators.length, 'creators');
      } else {
        console.log('[Test] Could not find JSON array in response');
      }
    } catch (parseErr) {
      console.error('[Test] Parse error:', parseErr.message);
    }
  } catch (err) {
    console.error('[Test] Error:', err.message);
    if (err.response) {
      console.error('[Test] Status:', err.response.status);
      console.error('[Test] Data:', JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

testScrape();
