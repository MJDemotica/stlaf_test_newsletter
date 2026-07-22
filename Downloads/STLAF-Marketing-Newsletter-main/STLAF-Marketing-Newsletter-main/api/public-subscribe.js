//
// File: public-subscribe.js
// Author: Juan Dela Cruz
// Date: 2026-06-09
// Purpose: Serverless endpoint handling new mailing list subscription registration requests, sending validation/verification emails via Gmail
//

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
import axios from "axios";

// ── GMAIL UTILS ─────────────────────────────────────────────────────────────

// ── GMAIL UTILS ─────────────────────────────────────────────────────────────

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
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'gmail_config')
        .maybeSingle();
      if (error || !data) return { connected: false };
      cachedGmailConfig = data.value;
      lastGmailConfigFetch = Date.now();
      return cachedGmailConfig;
    } catch (err) {
      console.error("Error reading Gmail config from Supabase:", err.message);
      return { connected: false };
    } finally {
      activeGmailConfigPromise = null;
    }
  })();

  return activeGmailConfigPromise;
}

async function saveGmailConfig(config) {
  try {
    cachedGmailConfig = Object.assign({}, cachedGmailConfig || {}, config);
    lastGmailConfigFetch = Date.now();
    await supabase
      .from('settings')
      .upsert({ key: 'gmail_config', value: cachedGmailConfig }, { onConflict: 'key' });
  } catch (err) {
    console.error("Error saving Gmail config to Supabase:", err.message);
    throw err;
  }
}

async function getOrRefreshAccessToken(gmailConfig) {
  if (!gmailConfig || !gmailConfig.connected) {
    throw new Error("Gmail is not connected.");
  }
  if (gmailConfig.accessToken && gmailConfig.tokenExpiry && Date.now() < gmailConfig.tokenExpiry - 60000) {
    return gmailConfig.accessToken;
  }
  if (!gmailConfig.refreshToken) {
    throw new Error("Refresh token is missing.");
  }
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET is not configured.");
  }
  try {
    const resp = await axios.post("https://oauth2.googleapis.com/token", {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: gmailConfig.refreshToken,
      grant_type: "refresh_token"
    });
    const { access_token, expires_in } = resp.data;
    const tokenExpiry = Date.now() + expires_in * 1000;
    
    const newConfig = {
      ...gmailConfig,
      accessToken: access_token,
      tokenExpiry
    };
    await saveGmailConfig(newConfig);
    return access_token;
  } catch (err) {
    console.error("Token Refresh Error:", err.response?.data || err.message);
    throw new Error(`Failed to refresh Gmail access token: ${err.message}`);
  }
}

function htmlToPlainText(html) {
  let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<li[^>]*>/gi, '\n* ');
  text = text.replace(/<\/p>|<br\s*\/?>|<\/div>|<\/tr>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"');
  return text.trim();
}

function buildMimeMessage(to, from, subject, bodyHtml) {
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const altBoundary = `----=_Part_Alt_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
  const plainText = htmlToPlainText(bodyHtml);

  const alternativeParts = [
    `--${altBoundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    plainText,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    bodyHtml,
    ``,
    `--${altBoundary}--`
  ].join('\r\n');

  const headerParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``
  ].join('\r\n');

  return Buffer.from(headerParts + alternativeParts).toString("base64").replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── HANDLER ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { name, email, tags } = req.body;
  if (!email || !name) {
    return res.status(400).json({ success: false, error: "Name and Email are required" });
  }

  try {
    const finalTags = Array.isArray(tags) ? tags : ['Newsletter'];

    const { data: existing } = await supabase
      .from('subscribers')
      .select('*')
      .ilike('email', email)
      .maybeSingle();

    const verificationToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Calculate verification URL
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    let hostUrl = `${protocol}://${host}`;
    if (hostUrl.includes('run.app') && !hostUrl.startsWith('https://')) {
      hostUrl = hostUrl.replace('http://', 'https://');
    }
    const verificationUrl = `${hostUrl}/api/public/verify?token=${verificationToken}&email=${encodeURIComponent(email)}`;

    // Attempt to send confirmation email via Gmail config if connected
    let emailSent = false;
    const config = await getGmailConfig();
    const isGmailConnected = config && config.connected && config.authorizedEmail;

    if (isGmailConnected) {
      try {
        const accessToken = await getOrRefreshAccessToken(config);
        const subject = 'Please verify your subscription';
        const bodyHtml = `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 700;">Welcome to the STLAF Newsletter, ${name}!</h2>
            <p style="color: #334155; font-size: 14px; line-height: 1.6;">
              Thank you for subscribing. To secure your email and activate your newsletter subscription, please confirm your interest by clicking the button below:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #dcae44; color: #000000; font-weight: bold; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px; display: inline-block; box-shadow: 0 3px 5px rgba(220,174,68,0.3);">
                Confirm Subscription
              </a>
            </div>
            <p style="color: #64748b; font-size: 12px; line-height: 1.5; background-color: #f8fafc; padding: 10px; border-radius: 6px;">
              Link not working? Copy and paste this directly into your browser address bar:<br/>
              <a href="${verificationUrl}" style="color: #bf8d1a; text-decoration: underline; font-family: monospace; font-size: 11px;">${verificationUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 11px; line-height: 1.4;">
              This link will expire in 24 hours. If you did not make this subscription request, you may safely ignore this message—no active subscription was created.
            </p>
          </div>
        `;
        const rawMessage = buildMimeMessage(email, config.authorizedEmail, subject, bodyHtml);
        await axios.post(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
          { raw: rawMessage },
          { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );
        emailSent = true;
        console.log(`[PUBLIC SUBSCRIPTION] Verification link sent to ${email}`);
      } catch (mailErr) {
        console.error('[PUBLIC MAIL SEND ERR] Failed to send verification mail:', mailErr.response?.data || mailErr.message);
      }
    }

    if (existing) {
      const mergedTags = Array.from(new Set([...(existing.tags || []), ...finalTags]));
      await supabase.from('subscribers').update({
        name: name || existing.name,
        status: 'pending',
        tags: mergedTags,
        verification_token: verificationToken,
        verification_expires_at: verificationExpiresAt
      }).eq('id', existing.id);
      console.log(`[PUBLIC SUBSCRIPTION] Updated subscriber to pending state: ${email}`);
    } else {
      await supabase.from('subscribers').insert({
        name, email, status: 'pending', tags: finalTags,
        added_by: 'public-portal',
        verification_token: verificationToken,
        verification_expires_at: verificationExpiresAt
      });
      console.log(`[PUBLIC SUBSCRIPTION] Added new unverified pending subscriber: ${email}`);
    }

    // Capture system/user notification in Supabase
    try {
      await supabase.from('notifications').insert({
        title: 'New Subscription Request 📬',
        message: `${email} requested to subscribe (${name}). Verification link sent.`,
        type: 'info',
        read: false,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Could not post system notification:', err.message);
    }

    return res.status(200).json({ 
      success: true, 
      emailSent, 
      verificationNeeded: true,
      devVerificationUrl: verificationUrl 
    });
  } catch (err) {
    console.error("[PUBLIC SUBSCRIPTION ERR]", err.response?.data || err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
