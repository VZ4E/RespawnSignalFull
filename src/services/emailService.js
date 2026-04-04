/**
 * Email Service
 * Handles sending emails via Resend
 */

const axios = require('axios');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendEmail(to, subject, htmlContent, options = {}) {
  if (!RESEND_API_KEY) {
    console.error('[Email] RESEND_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const payload = {
      from: options.from || 'noreply@respawnsignal.io',
      to,
      subject,
      html: htmlContent,
      ...options,
    };

    const response = await axios.post(RESEND_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    console.log(`[Email] ✓ Sent to ${to}: ${subject}`);
    return { success: true, messageId: response.data.id };
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send creator activity report
 */
async function sendCreatorReport(email, creatorName, reportData, options = {}) {
  const htmlContent = generateReportHTML(creatorName, reportData, options.whiteLabel);

  return sendEmail(email, `${creatorName} - Monthly Activity Report`, htmlContent, {
    from: options.from || 'reports@respawnsignal.io',
  });
}

/**
 * Generate HTML report template
 */
function generateReportHTML(creatorName, reportData, whiteLabel = false) {
  const {
    totalDeals = 0,
    dealHistory = [],
    scanCount = 0,
    topBrands = [],
    dateRange = {},
  } = reportData;

  const brandRows = topBrands
    .slice(0, 10)
    .map(
      (brand) =>
        `<tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 8px; font-size: 14px;">${brand.name}</td>
      <td style="padding: 8px; font-size: 14px; text-align: center;">${brand.count}</td>
      <td style="padding: 8px; font-size: 12px; color: #666;">${brand.types.join(', ')}</td>
    </tr>`
    )
    .join('');

  const dealRows = dealHistory
    .slice(0, 15)
    .map(
      (deal) =>
        `<tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 8px; font-size: 13px;">${new Date(deal.created_at).toLocaleDateString()}</td>
      <td style="padding: 8px; font-size: 13px;">${deal.brands?.join(', ') || 'Unknown'}</td>
      <td style="padding: 8px; font-size: 12px;">${deal.deal_type || 'Brand Deal'}</td>
    </tr>`
    )
    .join('');

  const brandingSection = whiteLabel
    ? `<div style="text-align: center; margin-bottom: 30px;">
    <h1 style="margin: 0; font-size: 28px; color: #1a1a1a;">${whiteLabel.agencyName}</h1>
    <p style="color: #666; margin: 5px 0 0 0;">Powered by RespawnSignal</p>
  </div>`
    : `<div style="text-align: center; margin-bottom: 30px;">
    <h1 style="margin: 0; font-size: 28px; color: #5b6aff;">RespawnSignal</h1>
    <p style="color: #666; margin: 5px 0 0 0;">Creator Intelligence Platform</p>
  </div>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      color: #333;
      line-height: 1.6;
      background: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .content {
      padding: 30px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      font-size: 18px;
      margin: 0 0 15px 0;
      color: #1a1a1a;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-box {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      text-align: center;
    }
    .stat-number {
      font-size: 24px;
      font-weight: bold;
      color: #667eea;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
      text-transform: uppercase;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      background: #f8f9fa;
      padding: 10px 8px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #eee;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #eee;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      text-decoration: none;
      font-weight: 500;
      margin-top: 15px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${brandingSection}
    </div>
    
    <div class="content">
      <div class="section">
        <h2>📊 Activity Summary: ${creatorName}</h2>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="stat-number">${totalDeals}</div>
            <div class="stat-label">Deals Found</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${scanCount}</div>
            <div class="stat-label">Scans</div>
          </div>
        </div>
        <p style="color: #666; font-size: 13px;">
          Report period: ${dateRange.start || 'N/A'} to ${dateRange.end || 'N/A'}
        </p>
      </div>

      ${
        topBrands.length > 0
          ? `
      <div class="section">
        <h2>🏆 Top Brands</h2>
        <table>
          <thead>
            <tr>
              <th>Brand</th>
              <th>Count</th>
              <th>Deal Types</th>
            </tr>
          </thead>
          <tbody>
            ${brandRows}
          </tbody>
        </table>
      </div>
      `
          : ''
      }

      ${
        dealHistory.length > 0
          ? `
      <div class="section">
        <h2>📝 Recent Deal History</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Brand</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            ${dealRows}
          </tbody>
        </table>
        ${dealHistory.length > 15 ? `<p style="font-size: 12px; color: #999;">... and ${dealHistory.length - 15} more deals</p>` : ''}
      </div>
      `
          : ''
      }
    </div>

    <div class="footer">
      <p>This is an automated report from RespawnSignal. Do not reply to this email.</p>
      <p style="margin: 10px 0 0 0; font-size: 11px;">© ${new Date().getFullYear()} RespawnSignal. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = {
  sendEmail,
  sendCreatorReport,
};
