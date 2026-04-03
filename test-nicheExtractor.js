/**
 * Test suite for nicheExtractor
 * Verifies that more specific niches (like Fortnite) take priority over generic ones (like Gaming)
 */

const { extractNicheHintFromUrl } = require('./src/utils/nicheExtractor');

// Test cases
const testCases = [
  {
    input: 'https://tiktok.com/@hotrodd',
    expected: null,
    description: 'No niche info',
  },
  {
    input: 'https://tiktok.com/profiles/gaming',
    expected: 'Variety Gaming',
    description: 'Generic gaming profile',
  },
  {
    input: 'https://tiktok.com/profiles/gaming/fortnite',
    expected: 'Fortnite/Battle Royale',
    description: 'CRITICAL: Fortnite should match BEFORE gaming (higher priority)',
  },
  {
    input: 'https://tiktok.com/profiles/fortnite',
    expected: 'Fortnite/Battle Royale',
    description: 'Direct fortnite profile',
  },
  {
    input: 'https://tiktok.com/profiles/minecraft/creative',
    expected: 'Minecraft/Sandbox',
    description: 'Minecraft with sandbox descriptor',
  },
  {
    input: 'https://tiktok.com/profiles/fps/valorant',
    expected: 'Valorant/Tactical FPS',
    description: 'Valorant should match before generic FPS',
  },
  {
    input: 'https://tiktok.com/profiles/fitness/athlete',
    expected: 'Athlete/Sports',
    description: 'Athlete matches before fitness',
  },
  {
    input: 'https://tiktok.com/profiles/creator/streaming',
    expected: 'Twitch Streaming/Content Creator',
    description: 'Streaming matches as specific category',
  },
  {
    input: 'https://tiktok.com/profiles/genshin/rpg',
    expected: 'Genshin Impact/RPG',
    description: 'Genshin should match specifically',
  },
  {
    input: 'https://tiktok.com/profiles/roblox',
    expected: 'Roblox/User-Generated Games',
    description: 'Roblox specific match',
  },
];

// Run tests
console.log('═══════════════════════════════════════════════════════════');
console.log('  NICHE EXTRACTOR TEST SUITE');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`\n📋 Test: ${testCase.description}`);
  console.log(`   Input: "${testCase.input}"`);
  
  const result = extractNicheHintFromUrl(testCase.input);
  
  console.log(`   Expected: ${testCase.expected || '(null)'}`);
  console.log(`   Got:      ${result.hint || '(null)'}`);
  
  const match = result.hint === testCase.expected;
  if (match) {
    console.log(`   ✅ PASS`);
    passed++;
  } else {
    console.log(`   ❌ FAIL`);
    failed++;
  }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${testCases.length}`);
if (failed === 0) {
  console.log('🎉 All tests passed!');
} else {
  console.log(`⚠️  ${failed} test(s) failed`);
}
console.log('═══════════════════════════════════════════════════════════');
