//
// File: public-unsubscribe.js
// Author: Juan Dela Cruz
// Date: 2026-06-09
// Purpose: Serverless endpoint handling subscriber opt-out/unsubscription requests and logging unsubscription reasons
//

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

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

  const { email, reason } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  try {
    // Find subscriber by email (case-insensitive)
    const { data: existing } = await supabase
      .from('subscribers')
      .select('*')
      .ilike('email', email)
      .maybeSingle();

    if (existing) {
      // Update existing subscriber to unsubscribed
      await supabase.from('subscribers').update({
        status: 'unsubscribed',
        unsubscribe_reason: reason || 'No reason specified',
        unsubscribed_at: new Date().toISOString()
      }).eq('id', existing.id);

      console.log(`[PUBLIC OPT-OUT] Unsubscribed subscriber: ${email}. Reason: ${reason}`);
      return res.status(200).json({ success: true, found: true });
    } else {
      // Email not found — insert a new unsubscribed record to block re-subscription
      await supabase.from('subscribers').insert({
        name: 'Anonymous',
        email,
        status: 'unsubscribed',
        tags: ['Unsubscribed'],
        added_at: new Date().toISOString(),
        added_by: 'public-portal-optout',
        unsubscribe_reason: reason || 'No reason specified'
      });

      console.log(`[PUBLIC OPT-OUT] Created unsubscribed record for unregistered email: ${email}`);
      return res.status(200).json({ success: true, found: false });
    }
  } catch (err) {
    console.error('[PUBLIC OPT-OUT ERR]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
