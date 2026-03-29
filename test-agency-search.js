/**
 * Test suite for Agency Search API routes
 * Tests: POST /save, GET /list, DELETE /:agencyId
 */

const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000/api/agency-search';

// Mock test data
const TEST_AGENCY = {
  agencyName: 'Test Agency Corp',
  agencyDomain: 'testagency.com',
  creators: [
    { handle: 'creator_one', platforms: ['tiktok'], followerCount: 150000 },
    { handle: 'creator_two', platforms: ['youtube', 'instagram'], followerCount: 500000 },
    { handle: 'creator_three', platforms: ['twitch'], followerCount: 75000 }
  ]
};

let testToken = null;
let savedAgencyId = null;

/**
 * Get or create a test token
 * For testing, we'll use a test auth token from environment
 */
async function getTestToken() {
  // Use a test token from environment (you'll need to set TEST_AUTH_TOKEN in .env)
  if (process.env.TEST_AUTH_TOKEN) {
    return process.env.TEST_AUTH_TOKEN;
  }
  console.error('❌ TEST_AUTH_TOKEN not set in .env');
  console.error('   Create a test user and set TEST_AUTH_TOKEN=Bearer <your-supabase-token>');
  process.exit(1);
}

/**
 * Test: POST /api/agency-search/save
 * Saves agency and creators to Supabase
 */
async function testSaveAgency() {
  console.log('\n🧪 Testing POST /api/agency-search/save');
  console.log('─'.repeat(50));

  try {
    const response = await axios.post(`${BASE_URL}/save`, TEST_AGENCY, {
      headers: {
        'Authorization': testToken,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Status:', response.status);
    console.log('✅ Response:', JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.agencyId) {
      savedAgencyId = response.data.agencyId;
      console.log(`✅ Agency saved with ID: ${savedAgencyId}`);
      console.log(`✅ Created ${response.data.creatorCount} creators`);
      return true;
    }
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    if (err.response?.status === 401) {
      console.error('   → Auth failed. Check TEST_AUTH_TOKEN in .env');
    }
    return false;
  }
}

/**
 * Test: GET /api/agency-search/list
 * Lists all agencies and their creators
 */
async function testListAgencies() {
  console.log('\n🧪 Testing GET /api/agency-search/list');
  console.log('─'.repeat(50));

  try {
    const response = await axios.get(`${BASE_URL}/list`, {
      headers: {
        'Authorization': testToken
      }
    });

    console.log('✅ Status:', response.status);
    console.log('✅ Count:', response.data.count);
    console.log('✅ Agencies:', response.data.agencies.length);

    if (response.data.agencies.length > 0) {
      const agency = response.data.agencies[0];
      console.log('\n   First agency:');
      console.log(`   - Name: ${agency.name}`);
      console.log(`   - Domain: ${agency.domain}`);
      console.log(`   - Creators: ${agency.creatorCount}`);
      console.log(`   - Created: ${agency.createdAt}`);
      return true;
    } else {
      console.log('✅ No agencies found (OK for fresh install)');
      return true;
    }
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    return false;
  }
}

/**
 * Test: DELETE /api/agency-search/:agencyId
 * Deletes an agency and its creators
 */
async function testDeleteAgency() {
  if (!savedAgencyId) {
    console.log('\n⏭️  Skipping DELETE test (no agency ID saved)');
    return true;
  }

  console.log('\n🧪 Testing DELETE /api/agency-search/:agencyId');
  console.log('─'.repeat(50));

  try {
    const response = await axios.delete(`${BASE_URL}/${savedAgencyId}`, {
      headers: {
        'Authorization': testToken
      }
    });

    console.log('✅ Status:', response.status);
    console.log('✅ Response:', JSON.stringify(response.data, null, 2));
    console.log(`✅ Agency ${savedAgencyId} deleted`);
    return true;
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║      AGENCY SEARCH API ROUTE TESTS                    ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  testToken = await getTestToken();
  console.log(`\n🔑 Using token: ${testToken.substring(0, 30)}...`);

  const results = [];
  results.push(await testSaveAgency());
  results.push(await testListAgencies());
  results.push(await testDeleteAgency());

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║      TEST SUMMARY                                      ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`\n✅ Passed: ${passed}/${total}`);

  if (passed === total) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
