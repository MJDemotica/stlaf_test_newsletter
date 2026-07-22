//
// File: cron.js
// Author: Juan Dela Cruz
// Date: 2026-06-09
// Purpose: Serverless cron handler for sending campaigns, checking execution intervals, and handling batch Gmail dispatching
//

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
import axios from 'axios';

// ── GMAIL CONFIG (Supabase) ────────────────────────────────────────────────────

let cachedGmailConfig = null;
let lastGmailConfigFetch = 0;
let activeGmailConfigPromise = null;

async function getGmailConfig() {
  if (cachedGmailConfig && Date.now() - lastGmailConfigFetch < 300000) {
    return cachedGmailConfig;
  }
  if (activeGmailConfigPromise) {
    return activeGmailConfigPromise;
  }

  activeGmailConfigPromise = (async () => {
    try {
      const { data } = await supabase
        .from('gmail_config')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      cachedGmailConfig = data || { connected: false };
      lastGmailConfigFetch = Date.now();
      return cachedGmailConfig;
    } catch (err) {
      console.error('Error reading Gmail config from Supabase:', err.message);
      return { connected: false };
    } finally {
      activeGmailConfigPromise = null;
    }
  })();

  return activeGmailConfigPromise;
}

async function saveGmailConfig(config) {
  try {
    await supabase.from('gmail_config').update({
      connected: config.connected,
      authorized_email: config.authorizedEmail,
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
      token_expiry: config.tokenExpiry
    }).eq('id', 1);
    cachedGmailConfig = Object.assign({}, cachedGmailConfig || {}, config);
    lastGmailConfigFetch = Date.now();
  } catch (err) {
    console.error('Error saving Gmail config to Supabase:', err.message);
    throw err;
  }
}

async function createEmailLog(campaignId, recipientEmail, details) {
  try {
    await supabase.from('email_logs').insert({
      campaign_id: campaignId,
      recipient_email: recipientEmail,
      status: details.status,
      error_message: details.errorMessage || null,
      sent_at: details.sentAt,
      gmail_message_id: details.gmailMessageId || null
    });
  } catch (err) {
    console.error('Error saving Email Log to Supabase:', err.message);
  }
}

async function updateCampaignCount(campaignId, status, sentCount, failedCount) {
  const updates = { status, sent_count: sentCount, failed_count: failedCount };
  if (status === 'sent') updates.sent_at = new Date().toISOString();
  try {
    await supabase.from('email_campaigns').update(updates).eq('id', campaignId);
  } catch (err) {
    console.error(`Error updating email_campaigns/${campaignId}:`, err.message);
  }
}

async function updateImportedPostStatus(postId, mailStatus) {
  if (!postId) return;
  try {
    await supabase.from('posts').update({
      mail_status: mailStatus,
      mail_sent_time: new Date().toISOString()
    }).eq('id', postId);
    console.log(`[CSR SCHEDULE] Updated post ${postId} mailStatus to ${mailStatus}`);
  } catch (err) {
    console.error(`[CSR SCHEDULE] Error updating post ${postId}:`, err.message);
  }
}

async function fetchScheduledCampaigns() {
  const { data } = await supabase.from('email_campaigns').select('*').eq('status', 'scheduled');
  return data || [];
}

// ── SCHEDULER LOGIC ──────────────────────────────────────────────────────────

const activeScheduledSends = new Set();

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const debugLogs = [];
  const addLog = (msg) => {
    const timestamp = new Date().toISOString();
    debugLogs.push(`[${timestamp}] ${msg}`);
    console.log(`[VERCEL CRON DEBUG] ${msg}`);
  };

  addLog("Vercel Cron Triggered.");

  const envs = {
    VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID ? `${process.env.VITE_FIREBASE_PROJECT_ID.substring(0, 4)}***` : "MISSING",
    VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY ? "CONFIGURED (hidden)" : "MISSING",
    GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID ? `${process.env.GMAIL_CLIENT_ID.substring(0, 10)}***` : "MISSING",
    GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET ? "CONFIGURED (hidden)" : "MISSING",
    GMAIL_REDIRECT_URI: process.env.GMAIL_REDIRECT_URI || "MISSING"
  };

  const report = {
    success: false,
    currentTime: new Date().toISOString(),
    currentTimeMs: Date.now(),
    environmentVariables: envs,
    debugLogs,
    gmailConfig: null,
    campaignsChecked: 0,
    triggeredCampaigns: [],
    details: []
  };

  // Validate critical env variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    addLog('CRITICAL ERROR: Supabase config is missing in Vercel Env variables!');
    return res.status(500).json({
      ...report,
      message: 'Vercel environment variables SUPABASE_URL or SUPABASE_SECRET_KEY are not configured in Vercel dashboard.'
    });
  }

  try {
    addLog('Fetching Gmail config from Supabase...');
    let config;
    try {
      config = await getGmailConfig();
      addLog(`Gmail info retrieved successfully. Connected status in DB: ${config?.connected}`);
      report.gmailConfig = {
        connected: !!config?.connected,
        authorizedEmail: config?.authorizedEmail || null,
        tokenExpiry: config?.tokenExpiry || null,
        hasRefreshToken: !!config?.refreshToken
      };
    } catch (dbErr) {
      addLog(`Database read for gmail_config failed: ${dbErr.message}`);
      return res.status(200).json({
        ...report,
        message: `Database error retrieving Gmail settings: ${dbErr.message}. Ensure SUPABASE_URL and SUPABASE_SECRET_KEY are correct.`
      });
    }

    if (!config || !config.connected) {
      addLog("Gmail is not connected in authorization settings yet.");
      return res.status(200).json({
        ...report,
        message: "Gmail is not connected yet in settings. Access token cannot be acquired."
      });
    }

    const forceCampaignId = req.query?.forceCampaignId;
    const forceRefresh = !!req.query?.force || !!forceCampaignId;

    addLog(`Fetching email campaigns from Supabase (forceRefresh: ${forceRefresh})...`);
    let campaigns = [];
    try {
      if (forceCampaignId) {
        const { data } = await supabase.from('email_campaigns').select('*').eq('id', forceCampaignId).maybeSingle();
        campaigns = data ? [data] : [];
      } else {
        campaigns = await fetchScheduledCampaigns();
      }
    } catch (campErr) {
      addLog(`Failed to fetch campaigns: ${campErr.message}`);
      return res.status(500).json({
        ...report,
        message: `Supabase error fetching email campaigns: ${campErr.message}`
      });
    }
    report.campaignsChecked = campaigns.length;
    addLog(`Found ${campaigns.length} campaigns in database.`);

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'stlaf-marketing-newsletter.vercel.app';
    const hostUrl = `${protocol}://${host}`;

    for (const campaign of campaigns) {
      const id = campaign.id;
      if (!id) continue;

      // Skip other campaigns if we are forcing a specific campaign
      if (forceCampaignId && id !== forceCampaignId) {
        continue;
      }

      const campaignInfo = {
        id,
        title: campaign.title,
        status: campaign.status,
        scheduledAt: campaign.scheduled_at || null,
        reason: ''
      };

      const isForced = forceCampaignId && id === forceCampaignId;

      if (campaign.status === 'scheduled' || isForced) {
        if (!campaign.scheduled_at && !isForced) {
          campaignInfo.reason = 'Ignored: Status is \'scheduled\' but scheduled_at timestamp is empty.';
          addLog(`Campaign "${campaign.title}" (${id}) ignored: scheduled_at is empty.`);
        } else {
          const schedTime = new Date(campaign.scheduled_at || '').getTime();
          const nowTime = Date.now();

          if (isNaN(schedTime) && !isForced) {
            campaignInfo.reason = `Ignored: Invalid scheduled date format: "${campaign.scheduled_at}"`;
            addLog(`Campaign "${campaign.title}" (${id}) ignored: invalid scheduled time format.`);
          } else if (schedTime > nowTime && !isForced) {
            const timeDiffSec = Math.round((schedTime - nowTime) / 1000);
            campaignInfo.reason = `Waiting: Scheduled for ${campaign.scheduled_at} (triggers in ${timeDiffSec} seconds).`;
            addLog(`Campaign "${campaign.title}" (${id}) is in the future. Scheduled: ${campaign.scheduled_at}. current: ${report.currentTime}`);
          } else if (activeScheduledSends.has(id)) {
            campaignInfo.reason = 'Ignored: Already processing sending lock.';
            addLog(`Campaign "${campaign.title}" (${id}) skipped: sending lock already active.`);
          } else {
            campaignInfo.reason = isForced ? 'Triggering forced sending cycle!' : 'Triggering sending cycle!';
            addLog(`TRIGGERED${isForced ? ' (FORCED)' : ''}: "${campaign.title}" (${id}) has reached its time or was forced!`);
            activeScheduledSends.add(id);
            report.triggeredCampaigns.push({ id, title: campaign.title });

            try {
              // Mark as sending in DB immediately to prevent duplicate runs
              await updateCampaignCount(id, 'sending', 0, 0);

              await executeCronSending(id, campaign, config, hostUrl);
              campaignInfo.reason += ' Sending cycle finished successfully.';
              addLog(`Sent successfully: "${campaign.title}"`);
            } catch (sendErr) {
              campaignInfo.reason += ` Sending cycle error: ${sendErr.message}`;
              addLog(`Sending failed for "${campaign.title}": ${sendErr.message}`);
            } finally {
              activeScheduledSends.delete(id);
            }
          }
        }
      } else {
        campaignInfo.reason = `Ignored: status is '${campaign.status}' (must be 'scheduled' or forced).`;
      }
      report.details.push(campaignInfo);
    }

    report.success = true;
    return res.status(200).json(report);
  } catch (globalErr) {
    addLog(`Global Cron error: ${globalErr.message}`);
    return res.status(500).json({
      ...report,
      error: globalErr.message
    });
  }
}

async function executeCronSending(campaignId, campaign, config, hostUrl) {
  try {
    const accessToken = await getOrRefreshAccessToken(config);

    // Extract tags
    let recipientTags = [];
    if (campaign.recipientTags) {
      if (Array.isArray(campaign.recipientTags)) {
        recipientTags = campaign.recipientTags;
      } else if (typeof campaign.recipientTags === 'string') {
        try {
          recipientTags = JSON.parse(campaign.recipientTags);
        } catch (e) {
          recipientTags = [];
        }
      }
    }

    // Get subscribers via Supabase
    let subscribers = [];
    try {
      const { data } = await supabase.from('subscribers').select('*');
      subscribers = data || [];
    } catch (subErr) {
      console.error(`[CRON] Failed to fetch subscribers: ${subErr.message}`);
      throw subErr;
    }

    const activeFilteredSubscribers = subscribers.filter(s => {
      if (s.status !== 'active') return false;
      if (recipientTags.length === 0) return true;

      const subTags = Array.isArray(s.tags) ? s.tags : [];
      return subTags.some(t => recipientTags.some(rt => rt.trim().toLowerCase() === t.trim().toLowerCase()));
    });

    console.log(`[VERCEL CRON] Sending to ${activeFilteredSubscribers.length} recipients for campaign: "${campaign.title}"`);
    await updateCampaignCount(campaignId, 'sending', 0, 0);

    const attachments = Array.isArray(campaign.attachments_json)
      ? campaign.attachments_json
      : (campaign.attachments_json ? (() => { try { return JSON.parse(campaign.attachments_json); } catch(e) { return []; } })() : []);

    let sentCount = 0;
    let failedCount = 0;

    for (const rec of activeFilteredSubscribers) {
      if (!rec.email) continue;
      const subject = (campaign.subject || '')
        .replace(/{{name}}/gi, rec.name || '')
        .replace(/{{email}}/gi, rec.email || '');

      const unsubscribeUrl = `${hostUrl}/unsubscribe?email=${encodeURIComponent(rec.email)}`;
      let body = (campaign.body || '')
        .replace(/{{name}}/gi, rec.name || '')
        .replace(/{{email}}/gi, rec.email || '');

      if (/{{unsubscribe}}/i.test(body)) {
        body = body.replace(/{{unsubscribe}}/gi, unsubscribeUrl);
      } else {
        const footerHtml = `
          <br/><br/>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
          <p style="font-size:12px;color:#64748b;font-family:sans-serif;text-align:center;line-height:1.5;">
            You are receiving this email because you subscribed to our list.<br/>
            If you no longer wish to receive these emails, you can 
            <a href="${unsubscribeUrl}" style="color:#c9a84c;text-decoration:underline;font-weight:600;">unsubscribe instantly here</a>.
          </p>
        `;
        if (body.includes("</body>")) {
          body = body.replace("</body>", `${footerHtml}</body>`);
        } else if (body.includes("</html>")) {
          body = body.replace("</html>", `${footerHtml}</html>`);
        } else {
          body += footerHtml;
        }
      }

      try {
        const rawMessage = buildMimeMessage(rec.email, config.authorizedEmail, subject, body, attachments);
        const sendResp = await axios.post(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          { raw: rawMessage },
          { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
        );
        sentCount++;
        await createEmailLog(campaignId, rec.email, {
          status: 'sent',
          sentAt: new Date().toISOString(),
          gmailMessageId: sendResp.data.id
        });
      } catch (err) {
        failedCount++;
        const errMsg = err.response?.data?.error?.message || err.message || "Unknown error";
        await createEmailLog(campaignId, rec.email, {
          status: 'failed',
          errorMessage: errMsg,
          sentAt: new Date().toISOString()
        });
      }
      await updateCampaignCount(campaignId, 'sending', sentCount, failedCount);
    }

    await updateCampaignCount(campaignId, 'sent', sentCount, failedCount);
    if (campaign && campaign.imported_post_id) {
      await updateImportedPostStatus(campaign.imported_post_id, 'authorized');
    }
    console.log(`[VERCEL CRON] Completed campaign "${campaign.title}" successfully.`);
  } catch (err) {
    console.error(`[VERCEL CRON ERR] Campaign sending failed:`, err.message);
    await updateCampaignCount(campaignId, 'failed', 0, 0);
  } finally {
    activeScheduledSends.delete(campaignId);
  }
}
