#!/usr/bin/env node

/**
 * Daily OpenClaw Activity Report
 * Sends git commits, file changes, time spent, and blockers to Discord
 * Run via cron: 0 18 * * * node scripts/daily-report.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || 'https://discord.com/api/webhooks/1488353215119495251/SdMorIa2-EbqFYFj8DOxn4a5Ha3Auio63CJYnmlO7cBFMWm2BizPqXFUHmcG7HMj1gtw';
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.join(__dirname, '..', 'workspace');
const AGENT_NAME = process.env.AGENT_NAME || process.env.USER || 'Unknown Agent';

async function getGitCommits() {
  try {
    const cmd = `git log --since="24 hours ago" --oneline --format="%h - %s (%an)"`;
    const output = execSync(cmd, { cwd: WORKSPACE, encoding: 'utf-8' });
    return output.trim().split('\n').filter(l => l.length > 0);
  } catch (e) {
    return [];
  }
}

async function getModifiedFiles() {
  try {
    const cmd = `git diff --name-only HEAD~24h..HEAD`;
    const output = execSync(cmd, { cwd: WORKSPACE, encoding: 'utf-8' });
    return output.trim().split('\n').filter(l => l.length > 0);
  } catch (e) {
    return [];
  }
}

function readActivityLog() {
  try {
    const logPath = path.join(WORKSPACE, 'memory', 'activity.json');
    if (fs.existsSync(logPath)) {
      return JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    }
  } catch (e) {
    console.warn('Could not read activity log:', e.message);
  }
  return { sessions: [], errors: [], blockers: [] };
}

async function sendDiscordReport(commits, files, activity) {
  const embed = {
    title: `📊 Daily OpenClaw Report — ${AGENT_NAME}`,
    color: 0x5aa0e8,
    timestamp: new Date().toISOString(),
    fields: [
      {
        name: '📝 Git Commits',
        value: commits.length > 0 ? commits.slice(0, 5).join('\n') : 'No commits',
        inline: false
      },
      {
        name: '📁 Files Modified',
        value: files.length > 0 ? files.slice(0, 10).join('\n') : 'No changes',
        inline: false
      },
      {
        name: '⏱️ Session Duration',
        value: activity.sessions?.length > 0 
          ? `${activity.sessions.length} sessions tracked` 
          : 'No sessions logged',
        inline: true
      },
      {
        name: '❌ Errors',
        value: activity.errors?.length > 0 
          ? activity.errors.slice(0, 3).join('\n') 
          : 'None',
        inline: true
      },
      {
        name: '🚧 Blockers',
        value: activity.blockers?.length > 0 
          ? activity.blockers.join('\n') 
          : 'None',
        inline: false
      }
    ]
  };

  const payload = {
    username: 'OpenClaw Daily Report',
    avatar_url: 'https://avatars.githubusercontent.com/u/openclaw',
    embeds: [embed]
  };

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`);
    }

    console.log('✅ Report sent to Discord');
  } catch (error) {
    console.error('❌ Failed to send Discord report:', error.message);
    process.exit(1);
  }
}

async function main() {
  console.log(`\n📡 Generating daily report for ${AGENT_NAME}...`);
  
  const commits = await getGitCommits();
  const files = await getModifiedFiles();
  const activity = readActivityLog();

  console.log(`Found ${commits.length} commits, ${files.length} files changed`);

  await sendDiscordReport(commits, files, activity);
  console.log('✅ Daily report complete\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
