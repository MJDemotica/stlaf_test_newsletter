//
// File: public-verify.js
// Author: Juan Dela Cruz
// Date: 2026-06-09
// Purpose: Serverless endpoint verifying email tokens from confirmation links and activating subscription records in Supabase
//

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
import axios from 'axios';

// ── HANDLER ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const { token, email } = req.query;

  const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  let hostUrl = `${protocol}://${host}`;
  if (hostUrl.includes('run.app') && !hostUrl.startsWith('https://')) {
    hostUrl = hostUrl.replace('http://', 'https://');
  }

  if (!token || !email) {
    return res.redirect(`${hostUrl}/subscribe?verified=invalid`);
  }

  try {
    // 1. Find subscriber by email (case-insensitive)
    const { data: existing } = await supabase
      .from('subscribers')
      .select('*')
      .ilike('email', email)
      .maybeSingle();

    if (!existing) {
      return res.redirect(`${hostUrl}/subscribe?verified=invalid`);
    }

    // 2. Already active — treat as success
    if (existing.status === 'active') {
      return res.redirect(`${hostUrl}/subscribe?verified=success&email=${encodeURIComponent(existing.email)}`);
    }

    // 3. Check token matches (snake_case column)
    if (existing.verification_token !== token) {
      return res.redirect(`${hostUrl}/subscribe?verified=invalid`);
    }

    // 4. Check expiration (snake_case column)
    if (existing.verification_expires_at) {
      const expiresAt = new Date(existing.verification_expires_at);
      if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
        // Token expired — delete the pending record
        await supabase.from('subscribers').delete().eq('id', existing.id);
        return res.redirect(`${hostUrl}/subscribe?verified=expired`);
      }
    }

    // 5. Activate subscriber, clear verification fields
    await supabase.from('subscribers').update({
      status: 'active',
      verified_at: new Date().toISOString(),
      verification_token: null,
      verification_expires_at: null
    }).eq('id', existing.id);

    console.log(`[PUBLIC SUBSCRIPTION] Verified subscriber: ${email}`);

    // 6. Create real-time dashboard notification in Supabase
    try {
      await supabase.from('notifications').insert({
        title: 'Subscriber Verified ✅',
        message: `${email} verified their email and is now an active subscriber!`,
        type: 'success',
        read: false,
        created_at: new Date().toISOString()
      });
    } catch (notifyErr) {
      console.warn('Could not post system notification:', notifyErr.message);
    }

    return res.redirect(`${hostUrl}/subscribe?verified=success&email=${encodeURIComponent(existing.email)}`);
  } catch (err) {
    console.error('[PUBLIC VERIFICATION ERR]', err.message);
    return res.redirect(`${hostUrl}/subscribe?verified=invalid`);
  }
}
