import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Track the redirect URI used to request the authorization code, to ensure identical match during token exchange
  let lastIssuedRedirectUri = "";
  let lastSeenHostUrl = "https://ais-dev-viko4leq6b2b2lwdflcjyt-478287189949.asia-east1.run.app";

  app.use(cors()); // Allow all origins for easier debugging in iframe
  app.use(express.json({ limit: '50mb' }));

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[SERVER] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    // Dynamically capture host URL
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    let currentUrl = `${protocol}://${host}`;
    if (currentUrl.includes("run.app") && !currentUrl.startsWith("https://")) {
      currentUrl = currentUrl.replace("http://", "https://");
    }
    lastSeenHostUrl = currentUrl;
    
    next();
  });

  // Firestore REST JSON Helpers (for secure server-side interactions)
  function toFirestoreJSON(obj: any) {
    const fields: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'boolean') {
        fields[key] = { booleanValue: val };
      } else if (typeof val === 'number') {
        fields[key] = { doubleValue: val };
      } else if (Array.isArray(val)) {
        fields[key] = {
          arrayValue: {
            values: val.map(item => {
              if (typeof item === 'boolean') return { booleanValue: item };
              if (typeof item === 'number') return { doubleValue: item };
              return { stringValue: String(item) };
            })
          }
        };
      } else {
        fields[key] = { stringValue: String(val || '') };
      }
    }
    return { fields };
  }

  function fromFirestoreJSON(doc: any) {
    if (!doc || !doc.fields) return null;
    const obj: any = {};
    for (const [key, valObj] of Object.entries(doc.fields)) {
      const vo = valObj as any;
      if (vo.booleanValue !== undefined) {
        obj[key] = vo.booleanValue;
      } else if (vo.doubleValue !== undefined) {
        obj[key] = Number(vo.doubleValue);
      } else if (vo.integerValue !== undefined) {
        obj[key] = Number(vo.integerValue);
      } else if (vo.stringValue !== undefined) {
        obj[key] = vo.stringValue;
      } else if (vo.arrayValue && vo.arrayValue.values) {
        obj[key] = vo.arrayValue.values.map((v: any) => v.booleanValue ?? v.doubleValue ?? v.integerValue ?? v.stringValue ?? '');
      } else {
        obj[key] = JSON.stringify(vo);
      }
    }
    return obj;
  }

  function getFirestoreUrl() {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || "(default)";
    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
  }

  function getApiKeyParam() {
    const apiKey = process.env.VITE_FIREBASE_API_KEY;
    return apiKey ? `?key=${apiKey}` : "";
  }

  async function getGmailConfig(): Promise<any> {
    const url = `${getFirestoreUrl()}/settings/gmail_config${getApiKeyParam()}`;
    try {
      const resp = await axios.get(url);
      return fromFirestoreJSON(resp.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        return { connected: false };
      }
      console.error("Error reading Gmail config from Firestore REST:", err.message);
      return { connected: false };
    }
  }

  async function saveGmailConfig(config: any) {
    const baseUrl = getFirestoreUrl();
    const apiKey = getApiKeyParam();
    const url = `${baseUrl}/settings/gmail_config${apiKey}`;
    const docData = toFirestoreJSON(config);
    try {
      await axios.patch(url, docData);
    } catch (err: any) {
      console.error("Error saving Gmail config to Firestore REST:", err.response?.data || err.message);
      throw err;
    }
  }

  async function createEmailLog(log: any) {
    const baseUrl = getFirestoreUrl();
    const apiKey = getApiKeyParam();
    const url = `${baseUrl}/emailLogs${apiKey}`;
    const docData = toFirestoreJSON(log);
    try {
      await axios.post(url, docData);
    } catch (err: any) {
      console.error("Error saving Email Log to Firestore REST:", err.response?.data || err.message);
    }
  }

  async function updateCampaignCount(campaignId: string, status: string, sentCount: number, failedCount: number) {
    const baseUrl = getFirestoreUrl();
    const apiKey = getApiKeyParam();
    const url = `${baseUrl}/emailCampaigns/${campaignId}${apiKey}`;
    try {
      const currentResp = await axios.get(url);
      const currentData = fromFirestoreJSON(currentResp.data) || {};
      const updatedData = {
        ...currentData,
        status,
        sentCount,
        failedCount,
        sentAt: status === 'sent' ? new Date().toISOString() : (currentData.sentAt || '')
      };
      await axios.patch(url, toFirestoreJSON(updatedData));
    } catch (err: any) {
      console.error(`Error updating emailCampaigns/${campaignId}:`, err.response?.data || err.message);
    }
  }

  async function getOrRefreshAccessToken(gmailConfig: any) {
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
    } catch (err: any) {
      console.error("Token Refresh Error:", err.response?.data || err.message);
      throw new Error(`Failed to refresh Gmail access token: ${err.message}`);
    }
  }

  function buildMimeMessage(to: string, from: string, subject: string, bodyHtml: string, attachments: any[] = []) {
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    
    if (!attachments || attachments.length === 0) {
      const messageParts = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${utf8Subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        bodyHtml
      ];
      const message = messageParts.join('\n');
      return Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }

    const boundary = `----=_Part_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
    
    const headerParts = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``
    ];

    const bodyParts = [
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      bodyHtml
    ];

    const attachmentParts = attachments.map(att => {
      let base64Data = att.content || "";
      if (base64Data.startsWith('data:')) {
        const parts = base64Data.split(';base64,');
        if (parts.length > 1) {
          base64Data = parts[1];
        }
      }
      
      return [
        `--${boundary}`,
        `Content-Type: ${att.type || 'application/octet-stream'}; name="${att.name}"`,
        `Content-Disposition: attachment; filename="${att.name}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        base64Data.replace(/(.{76})/g, '$1\r\n'),
        ``
      ].join('\r\n');
    });

    const footer = `--${boundary}--`;

    const fullMessage = [
      headerParts.join('\r\n'),
      bodyParts.join('\r\n'),
      ...attachmentParts,
      footer
    ].join('\r\n');

    return Buffer.from(fullMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // Gmail API Endpoints

  app.post("/api/gmail/auth-url", (req, res) => {
    const clientId = process.env.GMAIL_CLIENT_ID;
    
    // Check if the client passed its origin, otherwise detect dynamically from headers
    const clientOrigin = req.body?.origin;
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    
    let dynamicRedirect = clientOrigin 
      ? `${clientOrigin}/api/gmail/callback` 
      : `${protocol}://${host}/api/gmail/callback`;
      
    // Force https for Cloud Run deployment urls
    if (dynamicRedirect.includes("run.app") && !dynamicRedirect.startsWith("https://")) {
      dynamicRedirect = dynamicRedirect.replace("http://", "https://");
    }
    
    const rawRedirect = process.env.GMAIL_REDIRECT_URI;
    const redirectUri = (rawRedirect && rawRedirect.startsWith("http")) ? rawRedirect : dynamicRedirect;
    
    // Save the redirect URI for the subsequent authorization code token exchange
    lastIssuedRedirectUri = redirectUri;
    
    if (!clientId) {
      return res.status(400).json({ error: "GMAIL_CLIENT_ID environment variable is not configured on the server." });
    }
    const scopes = [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly"
    ].join(" ");
    
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;
    res.json({ url });
  });

  app.get("/api/gmail/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send("Authorization code is missing.");
    }
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    
    // Dynamically build redirect URI from request to match exactly what was sent
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    let dynamicRedirect = `${protocol}://${host}/api/gmail/callback`;
    
    if (dynamicRedirect.includes("run.app") && !dynamicRedirect.startsWith("https://")) {
      dynamicRedirect = dynamicRedirect.replace("http://", "https://");
    }
    
    const rawRedirect = process.env.GMAIL_REDIRECT_URI;
    
    // Fall back to the last issued redirect URL if no environment override is present
    let redirectUri = (rawRedirect && rawRedirect.startsWith("http")) ? rawRedirect : "";
    if (!redirectUri) {
      redirectUri = lastIssuedRedirectUri || dynamicRedirect;
    }
    
    if (!clientId || !clientSecret) {
      return res.status(500).send("Gmail OAuth credentials are not fully configured on the server.");
    }
    try {
      const resp = await axios.post("https://oauth2.googleapis.com/token", {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      });
      const { access_token, refresh_token, expires_in } = resp.data;
      const tokenExpiry = Date.now() + expires_in * 1000;
      
      const profileResp = await axios.get("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const authorizedEmail = profileResp.data.emailAddress;
      
      await saveGmailConfig({
        connected: true,
        authorizedEmail,
        accessToken: access_token,
        refreshToken: refresh_token || "",
        tokenExpiry
      });
      
      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #f8fafc; color: #1e293b;">
            <div style="max-width: 500px; margin: 0 auto; padding: 30px; border-radius: 8px; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
              <h1 style="color: #c9a84c;">Gmail Connected!</h1>
              <p>You have successfully authorized the portal to send emails.</p>
              <p>You can now close this window and return to the application.</p>
              <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; background-color: #c9a84c; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">Close Tab</button>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error("OAuth Exchange Error:", err.response?.data || err.message);
      res.status(500).send(`Failed to exchange authorization code: ${err.message}`);
    }
  });

  app.get("/api/gmail/status", async (req, res) => {
    try {
      const config = await getGmailConfig();
      res.json({
        connected: !!config.connected,
        authorizedEmail: config.authorizedEmail || null
      });
    } catch (err: any) {
      res.json({ connected: false });
    }
  });

  app.delete("/api/gmail/disconnect", async (req, res) => {
    try {
      const config = await getGmailConfig();
      if (config.accessToken) {
        try {
          await axios.get(`https://oauth2.googleapis.com/revoke?token=${config.accessToken}`);
        } catch (e) {
          // ignore
        }
      }
      await saveGmailConfig({ connected: false });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gmail/send-bulk", async (req, res) => {
    const { campaignId, recipients } = req.body;
    if (!campaignId || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: "Missing campaignId or recipients list." });
    }
    try {
      const config = await getGmailConfig();
      if (!config.connected) {
        return res.status(400).json({ error: "Gmail is not connected. Connect Gmail first." });
      }
      const accessToken = await getOrRefreshAccessToken(config);
      
      const campaignUrl = `${getFirestoreUrl()}/emailCampaigns/${campaignId}${getApiKeyParam()}`;
      const campaignResp = await axios.get(campaignUrl);
      const campaign = fromFirestoreJSON(campaignResp.data);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found." });
      }

      // Parse campaign-level attachments
      let attachments: any[] = [];
      if (campaign?.attachmentsJson) {
        try {
          attachments = JSON.parse(campaign.attachmentsJson);
        } catch (e) {
          console.error("Error parsing campaign attachmentsJson:", e);
        }
      }
      
      await updateCampaignCount(campaignId, 'sending', 0, 0);
      res.json({ success: true, message: "Campaign sending started in background." });
      
      const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      let hostUrl = `${protocol}://${host}`;
      if (hostUrl.includes("run.app") && !hostUrl.startsWith("https://")) {
        hostUrl = hostUrl.replace("http://", "https://");
      }

      (async () => {
        let sentCount = 0;
        let failedCount = 0;
        for (const rec of recipients) {
          const subject = (campaign.subject || "")
            .replace(/{{name}}/gi, rec.name || "")
            .replace(/{{email}}/gi, rec.email || "");

          const unsubscribeUrl = `${hostUrl}/unsubscribe?email=${encodeURIComponent(rec.email)}`;
          let body = (campaign.body || "")
            .replace(/{{name}}/gi, rec.name || "")
            .replace(/{{email}}/gi, rec.email || "");

          if (/{{unsubscribe}}/i.test(body)) {
            body = body.replace(/{{unsubscribe}}/gi, unsubscribeUrl);
          } else {
            body += `
              <br/><br/>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
              <p style="font-size:12px;color:#64748b;font-family:sans-serif;text-align:center;line-height:1.5;">
                You are receiving this email because you subscribed to our list.<br/>
                If you no longer wish to receive these emails, you can 
                <a href="${unsubscribeUrl}" style="color:#c9a84c;text-decoration:underline;font-weight:600;">unsubscribe instantly here</a>.
              </p>
            `;
          }

          try {
            const rawMessage = buildMimeMessage(rec.email, config.authorizedEmail, subject, body, attachments);
            const sendResp = await axios.post(
              "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
              { raw: rawMessage },
              { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
            );
            sentCount++;
            await createEmailLog({
              campaignId,
              recipientEmail: rec.email,
              status: 'sent',
              sentAt: new Date().toISOString(),
              gmailMessageId: sendResp.data.id
            });
          } catch (err: any) {
            failedCount++;
            const errMsg = err.response?.data?.error?.message || err.message || "Unknown error";
            await createEmailLog({
              campaignId,
              recipientEmail: rec.email,
              status: 'failed',
              errorMessage: errMsg,
              sentAt: new Date().toISOString()
            });
          }
          await updateCampaignCount(campaignId, 'sending', sentCount, failedCount);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        await updateCampaignCount(campaignId, 'sent', sentCount, failedCount);
      })();
    } catch (err: any) {
      console.error("Bulk Send Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Public Subscriber Portal Endpoints
  app.post("/api/public/subscribe", async (req, res) => {
    const { name, email, tags } = req.body;
    if (!email || !name) {
      return res.status(400).json({ success: false, error: "Name and Email are required" });
    }

    try {
      // 1. Fetch all subscribers to see if email already exists
      const subUrl = getFirestoreRestUrl("subscribers", "pageSize=300");
      const subResp = await axios.get(subUrl);
      const allDocs = subResp.data?.documents || [];
      const subscribers = allDocs.map((d: any) => {
        const sId = d.name.split("/").pop();
        return { id: sId, ...fromFirestoreJSON(d) };
      });

      const existing = subscribers.find((s: any) => s.email && s.email.toLowerCase() === email.toLowerCase());
      const finalTags = Array.isArray(tags) ? tags : ["Newsletter"];

      if (existing) {
        // Merge tags
        let subTags: string[] = [];
        if (Array.isArray(existing.tags)) {
          subTags = existing.tags;
        } else if (typeof existing.tags === 'string') {
          try {
            subTags = JSON.parse(existing.tags);
          } catch(e) {
            subTags = [existing.tags];
          }
        }
        const mergedTags = Array.from(new Set([...subTags, ...finalTags]));
        
        const updated = {
          ...existing,
          name: name || existing.name,
          status: "active",
          tags: mergedTags
        };

        const patchUrl = getFirestoreRestUrl(`subscribers/${existing.id}`);
        await axios.patch(patchUrl, toFirestoreJSON(updated));
        console.log(`[PUBLIC SUBSCRIPTION] Re-activated/Updated subscriber: ${email}`);
      } else {
        // Create new subscriber
        const newSub = {
          name,
          email,
          status: "active",
          tags: finalTags,
          addedAt: new Date().toISOString(),
          addedBy: "public-portal"
        };
        const postUrl = getFirestoreRestUrl("subscribers");
        await axios.post(postUrl, toFirestoreJSON(newSub));
        console.log(`[PUBLIC SUBSCRIPTION] New direct subscriber added: ${email}`);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("[PUBLIC SUBSCRIPTION ERR]", err.response?.data || err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/public/unsubscribe", async (req, res) => {
    const { email, reason } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    try {
      // 1. Fetch subscribers to locate match
      const subUrl = getFirestoreRestUrl("subscribers", "pageSize=300");
      const subResp = await axios.get(subUrl);
      const allDocs = subResp.data?.documents || [];
      const subscribers = allDocs.map((d: any) => {
        const sId = d.name.split("/").pop();
        return { id: sId, ...fromFirestoreJSON(d) };
      });

      const existing = subscribers.find((s: any) => s.email && s.email.toLowerCase() === email.toLowerCase());

      if (existing) {
        const updated = {
          ...existing,
          status: "unsubscribed",
          unsubscribeReason: reason || "No reason specified",
          unsubscribedAt: new Date().toISOString()
        };

        const patchUrl = getFirestoreRestUrl(`subscribers/${existing.id}`);
        await axios.patch(patchUrl, toFirestoreJSON(updated));
        console.log(`[PUBLIC OPT-OUT] Unsubscribed subscriber: ${email}. Reason: ${reason}`);
        res.json({ success: true, found: true });
      } else {
        // Email wasn't found in current active list, but we still want to make sure they are recorded so they don't get emailed
        // Let's add them as an "unsubscribed" record just in case!
        const newUnsub = {
          name: "Anonymous",
          email,
          status: "unsubscribed",
          tags: ["Unsubscribed"],
          addedAt: new Date().toISOString(),
          addedBy: "public-portal-optout",
          unsubscribeReason: reason || "No reason specified"
        };
        const postUrl = getFirestoreRestUrl("subscribers");
        await axios.post(postUrl, toFirestoreJSON(newUnsub));
        console.log(`[PUBLIC OPT-OUT] Created unsubscribed record for unregistered email: ${email}`);
        res.json({ success: true, found: false });
      }
    } catch (err: any) {
      console.error("[PUBLIC OPT-OUT ERR]", err.response?.data || err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Set to keep track of campaign IDs that are currently being processed
  const activeScheduledSends = new Set<string>();

  // Helper to build Firestore API Urls with query params cleanly
  function getFirestoreRestUrl(collectionPath: string, extraParams: string = "") {
    const baseUrl = getFirestoreUrl();
    const apiKey = process.env.VITE_FIREBASE_API_KEY;
    let url = `${baseUrl}/${collectionPath}`;
    const params: string[] = [];
    if (apiKey) {
      params.push(`key=${apiKey}`);
    }
    if (extraParams) {
      params.push(extraParams);
    }
    if (params.length > 0) {
      url += `?${params.join("&")}`;
    }
    return url;
  }

  async function checkAndSendScheduledCampaigns() {
    const config = await getGmailConfig();
    if (!config || !config.connected) {
      return; // Gmail is not connected yet
    }

    const campaignsUrl = getFirestoreRestUrl("emailCampaigns", "pageSize=300");
    let response;
    try {
      response = await axios.get(campaignsUrl);
    } catch (err: any) {
      console.error("[SCHEDULER] Error fetching campaigns for checklist:", err.message);
      return;
    }

    if (!response.data || !response.data.documents) {
      return;
    }

    for (const doc of response.data.documents) {
      const id = doc.name.split("/").pop();
      if (!id) continue;
      const campaign = fromFirestoreJSON(doc);
      if (!campaign || activeScheduledSends.has(id)) continue;

      // Check if campaign is scheduled and is past scheduled date-time
      if (campaign.status === "scheduled" && campaign.scheduledAt) {
        const schedTime = new Date(campaign.scheduledAt).getTime();
        const nowTime = Date.now();

        if (!isNaN(schedTime) && schedTime <= nowTime) {
          console.log(`[SCHEDULER] Campaign detected for sending: "${campaign.title}" (${id}), scheduled for ${campaign.scheduledAt}`);
          activeScheduledSends.add(id);

          // Mark as sending in DB immediately to prevent duplicate runs
          await updateCampaignCount(id, "sending", 0, 0);

          // Execute sending in non-blocking background
          runScheduledCampaignSending(id, campaign, config);
        }
      }
    }
  }

  async function runScheduledCampaignSending(campaignId: string, campaign: any, config: any) {
    try {
      const accessToken = await getOrRefreshAccessToken(config);

      // Extract recipient tags from campaign
      let recipientTags: string[] = [];
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

      // Fetch subscribers from Firestore REST API
      const subUrl = getFirestoreRestUrl("subscribers", "pageSize=300");
      const subResp = await axios.get(subUrl);
      const allDocs = subResp.data?.documents || [];
      const subscribers = allDocs.map((d: any) => {
        const sId = d.name.split("/").pop();
        return { id: sId, ...fromFirestoreJSON(d) };
      });

      // Filter active and matching subscribers
      const activeFilteredSubscribers = subscribers.filter((s: any) => {
        if (s.status !== "active") return false;
        if (recipientTags.length === 0) return true; // All Active Subscribers
        
        let subTags: string[] = [];
        if (Array.isArray(s.tags)) {
          subTags = s.tags;
        } else if (typeof s.tags === 'string') {
          try {
            subTags = JSON.parse(s.tags);
          } catch (e) {
            subTags = s.tags.split(',').map((t: string) => t.trim());
          }
        }
        return subTags.some((t: string) => recipientTags.includes(t));
      });

      console.log(`[SCHEDULER] Filtered ${activeFilteredSubscribers.length} active subscribers for scheduled campaign "${campaign.title}"`);

      let attachments: any[] = [];
      if (campaign.attachmentsJson) {
        try {
          attachments = JSON.parse(campaign.attachmentsJson);
        } catch (e) {
          console.error("[SCHEDULER] Error parsing campaign attachmentsJson:", e);
        }
      }

      let sentCount = 0;
      let failedCount = 0;

      for (const rec of activeFilteredSubscribers) {
        if (!rec.email) continue;
        const subject = (campaign.subject || "")
          .replace(/{{name}}/gi, rec.name || "")
          .replace(/{{email}}/gi, rec.email || "");

        const unsubscribeUrl = `${lastSeenHostUrl}/unsubscribe?email=${encodeURIComponent(rec.email)}`;
        let body = (campaign.body || "")
          .replace(/{{name}}/gi, rec.name || "")
          .replace(/{{email}}/gi, rec.email || "");

        if (/{{unsubscribe}}/i.test(body)) {
          body = body.replace(/{{unsubscribe}}/gi, unsubscribeUrl);
        } else {
          body += `
            <br/><br/>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
            <p style="font-size:12px;color:#64748b;font-family:sans-serif;text-align:center;line-height:1.5;">
              You are receiving this email because you subscribed to our list.<br/>
              If you no longer wish to receive these emails, you can 
              <a href="${unsubscribeUrl}" style="color:#c9a84c;text-decoration:underline;font-weight:600;">unsubscribe instantly here</a>.
            </p>
          `;
        }

        try {
          const rawMessage = buildMimeMessage(rec.email, config.authorizedEmail, subject, body, attachments);
          const sendResp = await axios.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            { raw: rawMessage },
            { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
          );
          sentCount++;
          await createEmailLog({
            campaignId,
            recipientEmail: rec.email,
            status: 'sent',
            sentAt: new Date().toISOString(),
            gmailMessageId: sendResp.data.id
          });
        } catch (err: any) {
          failedCount++;
          const errMsg = err.response?.data?.error?.message || err.message || "Unknown error";
          await createEmailLog({
            campaignId,
            recipientEmail: rec.email,
            status: 'failed',
            errorMessage: errMsg,
            sentAt: new Date().toISOString()
          });
        }
        await updateCampaignCount(campaignId, 'sending', sentCount, failedCount);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      await updateCampaignCount(campaignId, 'sent', sentCount, failedCount);
      console.log(`[SCHEDULER] Scheduled campaign "${campaign.title}" successfully completed! Sent: ${sentCount}, Failed: ${failedCount}`);
    } catch (err: any) {
      console.error(`[SCHEDULER] Error sending scheduled campaign ${campaignId}:`, err.message);
      await updateCampaignCount(campaignId, 'failed', 0, 0);
    } finally {
      activeScheduledSends.delete(campaignId);
    }
  }

  // Start periodic scheduler checks
  setInterval(async () => {
    try {
      await checkAndSendScheduledCampaigns();
    } catch (e: any) {
      console.error("[SCHEDULER INTERVAL ERR] Error in scheduled run:", e.message);
    }
  }, 15000); // Trigger check every 15 seconds for quick response!

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  
  return { app, server };
}

const serverPromise = startServer();
export default (await serverPromise).app;
