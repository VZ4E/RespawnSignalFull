/**
 * Plan Configuration
 * Defines scan ranges, credit costs, and feature limits per plan
 */

const planConfig = {
  plans: {
    none: {
      name: 'None',
      credits: 0,
      maxRange: 0,
      youtube: {},
      instagram: {},
      tiktok: {},
      twitch: {},
    },
    starter: {
      name: 'Starter',
      credits: 1000,
      maxRange: 30,
      youtube: {
        last3: { label: 'Last 3 Videos', depth: 3 },
        last14: { label: 'Last 14 Videos', depth: 14 },
        last30: { label: 'Last 30 Videos', depth: 30 },
      },
      instagram: {
        last3: { label: 'Last 3 Posts', depth: 3 },
        last14: { label: 'Last 14 Posts', depth: 14 },
        last30: { label: 'Last 30 Posts', depth: 30 },
      },
      tiktok: {
        last3: { label: 'Last 3 Videos', depth: 3 },
        last14: { label: 'Last 14 Videos', depth: 14 },
        last30: { label: 'Last 30 Videos', depth: 30 },
      },
      twitch: {
        last3: { label: 'Last 3 Streams', depth: 3 },
        last14: { label: 'Last 14 Streams', depth: 14 },
        last30: { label: 'Last 30 Streams', depth: 30 },
      },
    },
    pro: {
      name: 'Pro',
      credits: 2500,
      maxRange: 30,
      youtube: {
        last3: { label: 'Last 3 Videos', depth: 3 },
        last14: { label: 'Last 14 Videos', depth: 14 },
        last30: { label: 'Last 30 Videos', depth: 30 },
      },
      instagram: {
        last3: { label: 'Last 3 Posts', depth: 3 },
        last14: { label: 'Last 14 Posts', depth: 14 },
        last30: { label: 'Last 30 Posts', depth: 30 },
      },
      tiktok: {
        last3: { label: 'Last 3 Videos', depth: 3 },
        last14: { label: 'Last 14 Videos', depth: 14 },
        last30: { label: 'Last 30 Videos', depth: 30 },
      },
      twitch: {
        last3: { label: 'Last 3 Streams', depth: 3 },
        last14: { label: 'Last 14 Streams', depth: 14 },
        last30: { label: 'Last 30 Streams', depth: 30 },
      },
    },
    agency: {
      name: 'Agency',
      credits: 5000,
      maxRange: 30,
      youtube: {
        last3: { label: 'Last 3 Videos', depth: 3 },
        last14: { label: 'Last 14 Videos', depth: 14 },
        last30: { label: 'Last 30 Videos', depth: 30 },
      },
      instagram: {
        last3: { label: 'Last 3 Posts', depth: 3 },
        last14: { label: 'Last 14 Posts', depth: 14 },
        last30: { label: 'Last 30 Posts', depth: 30 },
      },
      tiktok: {
        last3: { label: 'Last 3 Videos', depth: 3 },
        last14: { label: 'Last 14 Videos', depth: 14 },
        last30: { label: 'Last 30 Videos', depth: 30 },
      },
      twitch: {
        last3: { label: 'Last 3 Streams', depth: 3 },
        last14: { label: 'Last 14 Streams', depth: 14 },
        last30: { label: 'Last 30 Streams', depth: 30 },
      },
    },
    enterprise: {
      name: 'Enterprise',
      credits: 9999,
      maxRange: 30,
      youtube: {
        last3: { label: 'Last 3 Videos', depth: 3 },
        last14: { label: 'Last 14 Videos', depth: 14 },
        last30: { label: 'Last 30 Videos', depth: 30 },
      },
      instagram: {
        last3: { label: 'Last 3 Posts', depth: 3 },
        last14: { label: 'Last 14 Posts', depth: 14 },
        last30: { label: 'Last 30 Posts', depth: 30 },
      },
      tiktok: {
        last3: { label: 'Last 3 Videos', depth: 3 },
        last14: { label: 'Last 14 Videos', depth: 14 },
        last30: { label: 'Last 30 Videos', depth: 30 },
      },
      twitch: {
        last3: { label: 'Last 3 Streams', depth: 3 },
        last14: { label: 'Last 14 Streams', depth: 14 },
        last30: { label: 'Last 30 Streams', depth: 30 },
      },
    },
  },
  caches: {
    youtube: 7 * 24 * 60 * 60 * 1000, // 7 days
    instagram: 3 * 24 * 60 * 60 * 1000, // 3 days
    tiktok: 1 * 24 * 60 * 60 * 1000, // 1 day
    twitch: 1 * 24 * 60 * 60 * 1000, // 1 day
  },
  creditCost: 1, // 1 credit per scan across all platforms
};

module.exports = planConfig;
