//
// File: upload.js
// Purpose: Uploads base64 image data to Supabase Storage and returns a public URL
//

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { fileData, fileName, fileType } = req.body;
  if (!fileData) return res.status(400).json({ error: 'Missing fileData (base64 string).' });

  try {
    let base64Pure = fileData;
    if (fileData.startsWith('data:')) {
      base64Pure = fileData.split(';base64,')[1];
    }
    const buffer = Buffer.from(base64Pure, 'base64');
    const safeFileName = `campaign-images/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`;

    const { error: uploadError } = await supabase.storage
      .from('campaign-media')
      .upload(safeFileName, buffer, { contentType: fileType || 'image/png', upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from('campaign-media').getPublicUrl(safeFileName);

    return res.status(200).json({ success: true, downloadUrl: publicUrlData.publicUrl });
  } catch (err) {
    console.error('[UPLOAD ERR]', err.message);
    return res.status(500).json({ error: `Upload failed: ${err.message}` });
  }
}