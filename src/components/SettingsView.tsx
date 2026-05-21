import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Mail, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Bell, 
  Shield, 
  Check, 
  Info,
  ExternalLink 
} from 'lucide-react';
import { RoleManager } from './RoleManager';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface SettingsViewProps {
  userRole: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ userRole }) => {
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; authorizedEmail: string | null }>({
    connected: false,
    authorizedEmail: null
  });
  const [loading, setLoading] = useState(true);
  
  // Notification Toggles State
  const [notifyBounces, setNotifyBounces] = useState(true);
  const [notifyWeeklyStats, setNotifyWeeklyStats] = useState(false);
  const [notifyCampaignFinished, setNotifyCampaignFinished] = useState(true);

  const fetchGmailStatus = async () => {
    try {
      const resp = await axios.get('/api/gmail/status');
      setGmailStatus(resp.data);
    } catch (err) {
      console.error("Failed to load Gmail integration status", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGmailStatus();
  }, []);

  const handleConnectGmail = async () => {
    try {
      // Get auth redirect url from server
      const resp = await axios.post('/api/gmail/auth-url', { origin: window.location.origin });
      if (resp.data.url) {
        // Since we are strictly inside an iframe, let's open Gmail authentication popup or normal tab
        // Let's use window.open as standard or redirect current tab. Opening in a new tab is much cleaner!
        window.open(resp.data.url, '_blank', 'width=600,height=600');
        toast.success("Opening secure Google Authorization window...");
        
        // Start polling for connection success every 3 seconds
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          const check = await axios.get('/api/gmail/status');
          if (check.data.connected) {
            setGmailStatus(check.data);
            toast.success(`Successfully connected ${check.data.authorizedEmail}!`);
            clearInterval(interval);
          }
          if (attempts > 40) clearInterval(interval); // Stop after 2 mins
        }, 3000);
      }
    } catch (e: any) {
      toast.error(`Gmail config endpoint error: ${e.response?.data?.error || e.message}`);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!window.confirm("Are you sure you want to revoke authorization and disconnect Gmail?")) return;
    try {
      await axios.delete('/api/gmail/disconnect');
      setGmailStatus({ connected: false, authorizedEmail: null });
      toast.success("Gmail integration disconnected.");
    } catch (e: any) {
      toast.error("Failed to revoke token");
    }
  };

  const mockToastNotifications = (msg: string, title?: string, type?: string) => {
    if (type === 'success') {
      toast.success(`${title || 'Success'}: ${msg}`);
    } else {
      toast(msg);
    }
  };

  if (userRole !== 'marketing_supervisor') {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg mx-auto space-y-3">
        <Shield className="w-12 h-12 text-slate-300 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Supervisor Access Only</h2>
        <p className="text-sm text-slate-500">Only authorized marketing supervisors can access settings, integrations, and manage system roles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings & Channels</h1>
        <p className="text-sm text-slate-500">Enable notification rules, manage Google/Gmail API channels, and audit supervisor user roles.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Gmail Integration + Toggles */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Gmail API configuration block */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-sm text-slate-950 dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-500" /> Gmail API Channel
            </h2>

            <p className="text-xs text-slate-500">
              Deliver unlimited campaign emails using your secure Gmail / Google Workspace account directly. Uses standard Oauth2.
            </p>

            {loading ? (
              <p className="text-xs text-slate-400">Inspecting Google credentials...</p>
            ) : gmailStatus.connected ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-100 flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Bearer Token Live</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-mono">{gmailStatus.authorizedEmail}</p>
                  </div>
                </div>

                <button
                  onClick={handleDisconnectGmail}
                  className="w-full text-center px-4 py-2 bg-red-50 hover:bg-red-100 text-red-650 rounded-lg text-xs font-semibold transition-all"
                >
                  Disconnect Account
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={handleConnectGmail}
                  className="w-full text-center px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg text-sm shadow flex items-center justify-center gap-2"
                >
                  Connect Google Account <ExternalLink className="w-4 h-4" />
                </button>
                <p className="text-[10px] text-slate-400 italic text-center">Scopes: gmail.send and gmail.readonly</p>
              </div>
            )}
          </div>

          {/* Toggle preferences */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-sm text-slate-950 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" /> Notify Toggles
            </h2>

            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Alert on Bounce Failures</span>
                <input
                  type="checkbox"
                  checked={notifyBounces}
                  onChange={(e) => {
                    setNotifyBounces(e.target.checked);
                    toast.success("Updated bounces notification rule");
                  }}
                  className="accent-amber-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Digest Report (Weekly)</span>
                <input
                  type="checkbox"
                  checked={notifyWeeklyStats}
                  onChange={(e) => {
                    setNotifyWeeklyStats(e.target.checked);
                    toast.success("Updated weekly performance summaries");
                  }}
                  className="accent-amber-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Success alerts on Send</span>
                <input
                  type="checkbox"
                  checked={notifyCampaignFinished}
                  onChange={(e) => {
                    setNotifyCampaignFinished(e.target.checked);
                    toast.success("Updated campaign alert rules");
                  }}
                  className="accent-amber-500 w-4 h-4"
                />
              </label>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl flex gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Google Workspace OAuth credentials (GMAIL_CLIENT_ID & GMAIL_CLIENT_SECRET) are held encrypted and mapped natively inside the Express server. At no point are access keys emitted client side.
            </p>
          </div>

        </div>

        {/* Right Column: Portal User Role audit Manager */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h2 className="font-extrabold text-sm text-slate-950 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <Shield className="w-4.5 h-4.5 text-amber-500" /> Portal Permissions Auditor
            </h2>
            <RoleManager addNotification={mockToastNotifications} />
          </div>
        </div>

      </div>
    </div>
  );
};
