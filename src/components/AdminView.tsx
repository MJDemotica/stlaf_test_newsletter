import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  AlertCircle, 
  Edit2, 
  Trash2, 
  X,
  FolderOpen,
  Info,
  Bell,
  Mail,
  Zap,
  History,
  ExternalLink,
  Download,
  ClipboardList,
  Facebook,
  Instagram,
  CheckCircle2,
  Clock,
  Check,
  Music2,
  Shield,
  Lock,
  MessageSquare,
  Send,
  User,
  Linkedin,
  Twitter,
  Youtube,
  Globe,
  PlusCircle,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud, RefreshCw, Users as UsersIcon, UserCog, Upload, Mail as MailIcon } from 'lucide-react';
import { RoleManager } from './RoleManager';
import { SUPPORTED_SOCIAL_PLATFORMS } from '../constants';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, arrayUnion, limit } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

export const AdminView = ({ 
  notificationSettings,
  onUpdateNotificationSettings,
  exportSettings,
  onUpdateExportSettings,
  addNotification,
  quickLinks,
  onUpdateQuickLinks,
  socialLinks,
  onUpdateSocialLinks,
  onRestore,
  onBackupData,
  onRestoreData,
  isSeeding,
  governanceSettings,
  onUpdateGovernanceSettings,
  profile,
  pendingConcernsCount,
  refreshKey
}: { 
  notificationSettings: any,
  onUpdateNotificationSettings: (settings: any) => void,
  governanceSettings: any,
  onUpdateGovernanceSettings: (settings: any) => void,
  exportSettings: any,
  onUpdateExportSettings: (settings: any) => void,
  addNotification: (title: string, message: string, type?: 'info' | 'success' | 'warning') => void,
  quickLinks: {id: string, name: string, url: string}[],
  onUpdateQuickLinks: (links: {id: string, name: string, url: string}[]) => void,
  socialLinks: { facebook: string, instagram: string, tiktok: string },
  onUpdateSocialLinks: (links: any) => void,
  onRestore: () => void,
  onBackupData: () => void,
  onRestoreData: (e: React.ChangeEvent<HTMLInputElement>) => void,
  isSeeding: boolean,
  profile: any,
  pendingConcernsCount?: number,
  refreshKey?: number
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'concerns' | 'links' | 'settings'>('users');
  const [localSettings, setLocalSettings] = useState(notificationSettings);
  const [localGovernanceSettings, setLocalGovernanceSettings] = useState(governanceSettings);
  const [localExportSettings, setLocalExportSettings] = useState(exportSettings);
  const [localQuickLinks, setLocalQuickLinks] = useState(quickLinks || []);
  const [localSocialLinks, setLocalSocialLinks] = useState(socialLinks);
  const [concerns, setConcerns] = useState<any[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [expandedConcernId, setExpandedConcernId] = useState<string | null>(null);

  const [isUpdatingLinks, setIsUpdatingLinks] = useState(false);
  const [showLinksConfirm, setShowLinksConfirm] = useState(false);
  const [linksUpdateSuccess, setLinksUpdateSuccess] = useState(false);
  const [showResetVerify, setShowResetVerify] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [fbPageInfo, setFbPageInfo] = useState<{
    name: string, 
    link: string, 
    picture?: {data: {url: string}},
    instagram_business_account?: {
      id: string,
      username: string,
      name: string,
      profile_picture_url: string
    }
  } | null>(null);
  const [isLoadingFBInfo, setIsLoadingFBInfo] = useState(false);

  useEffect(() => {
    const fetchFBPageInfo = async (isRetry = false) => {
      setIsLoadingFBInfo(true);
      try {
        const response = await fetch('/api/facebook-page-info', {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!response.ok) {
          const text = await response.text();
          console.warn(`FB API returned ${response.status}: ${text}`);
          return;
        }

        const data = await response.json();
        if (data.success) {
          setFbPageInfo(data.pageInfo);
        } else {
          console.info("FB Page info fetch returned success:false", data.error);
        }
      } catch (err: any) {
        console.error("Failed to fetch FB Page info:", err);
        // If it's a transient network error, try once after a delay
        if (!isRetry && err.message === 'Failed to fetch') {
          console.log("Retrying FB Page info fetch in 2 seconds...");
          setTimeout(() => fetchFBPageInfo(true), 2000);
        }
      } finally {
        setIsLoadingFBInfo(false);
      }
    };

    fetchFBPageInfo();
  }, []);

  useEffect(() => {
    setLocalSettings(notificationSettings);
  }, [notificationSettings]);

  useEffect(() => {
    setLocalGovernanceSettings(governanceSettings);
  }, [governanceSettings]);

  useEffect(() => {
    setLocalExportSettings(exportSettings);
  }, [exportSettings]);

  useEffect(() => {
    if (quickLinks) setLocalQuickLinks(quickLinks);
  }, [quickLinks]);

  useEffect(() => {
    setLocalSocialLinks(socialLinks);
  }, [socialLinks]);

  useEffect(() => {
    const q = query(
      collection(db, 'concerns'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setConcerns(entries);
    });

    return () => unsubscribe();
  }, [refreshKey]);

  const handleUpdateQuickLinks = async () => {
    setIsUpdatingLinks(true);
    try {
      await onUpdateQuickLinks(localQuickLinks);
      setLinksUpdateSuccess(true);
      addNotification('Links Updated', 'Quick links have been updated successfully.', 'success');
      setTimeout(() => setLinksUpdateSuccess(false), 3000);
      setShowLinksConfirm(false);
    } catch (error) {
      addNotification('Update Failed', 'There was an error updating the quick links.', 'warning');
    } finally {
      setIsUpdatingLinks(false);
    }
  };

  const handleSaveSettings = () => {
    onUpdateNotificationSettings(localSettings);
    addNotification('Settings Updated', 'Notification settings have been updated successfully.', 'success');
  };

  const handleSaveGovernanceSettings = () => {
    onUpdateGovernanceSettings(localGovernanceSettings);
    addNotification('Governance Updated', 'System governance settings have been updated.', 'success');
  };

  const handleSendReply = async (concernId: string) => {
    if (!replyText.trim()) return;
    setIsSubmittingReply(true);
    try {
      const newMessage = {
        text: replyText.trim(),
        senderId: profile?.uid || 'supervisor',
        senderName: profile?.displayName || profile?.email || 'Supervisor',
        role: 'supervisor',
        timestamp: new Date().toISOString()
      };

      await updateDoc(doc(db, 'concerns', concernId), {
        messages: arrayUnion(newMessage),
        status: 'reviewed'
      });
      toast.success("Reply sent successfully.");
      setReplyingTo(null);
      setReplyText('');
    } catch (error) {
      console.error("Error sending reply:", error);
      toast.error("Failed to send reply.");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const tabs = [
    { id: 'users', label: 'User Operations', icon: <UserCog className="w-4 h-4" /> },
    { id: 'concerns', label: 'User Concerns', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'links', label: 'Quick Links', icon: <ExternalLink className="w-4 h-4" /> },
    { id: 'settings', label: 'System Settings', icon: <Zap className="w-4 h-4" /> }
  ] as const;

  const handleTogglePlatform = (platformId: string) => {
    setLocalSocialLinks(prev => {
      const newLinks = { ...prev };
      if (platformId in newLinks) {
        delete newLinks[platformId];
      } else {
        newLinks[platformId] = '';
      }
      return newLinks;
    });
  };

  return (
    <div className="space-y-8">
      {/* Admin Tab Header */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-end">
          <div className="hidden md:flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl transition-colors duration-300">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'concerns' && pendingConcernsCount !== undefined && pendingConcernsCount > 0 && (
                  <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                    {pendingConcernsCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          className="space-y-8"
        >
          {activeTab === 'users' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden min-h-[600px] transition-colors duration-300">
                <RoleManager addNotification={addNotification} refreshKey={refreshKey} />
              </div>
            </motion.div>
          )}

          {activeTab === 'concerns' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm transition-colors duration-300 overflow-hidden">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Recent User Concerns</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Messages submitted by users via the Help & Support tab.</p>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total: {concerns.length}</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {concerns.length === 0 ? (
                    <div className="p-20 text-center">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MailIcon className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-slate-400 font-bold">No concerns reported yet.</p>
                    </div>
                  ) : (
                    concerns.map(item => {
                      const userInitial = (item.userName || item.userEmail || 'U').charAt(0).toUpperCase();
                      const isExpanded = expandedConcernId === item.id;
                      const hasMessages = item.messages && item.messages.length > 0;
                      const lastMessagePreview = hasMessages 
                        ? item.messages[item.messages.length - 1].text 
                        : (item.message || 'No messages yet');

                      return (
                        <div 
                          key={item.id} 
                          className={`border-b last:border-0 border-slate-100 dark:border-slate-800 transition-all ${
                            isExpanded ? 'bg-slate-50/50 dark:bg-slate-800/40 shadow-inner' : 'hover:bg-slate-50/30 dark:hover:bg-slate-800/20'
                          }`}
                        >
                          {/* Minimized Header / Toggle */}
                          <div 
                            onClick={() => setExpandedConcernId(isExpanded ? null : item.id)}
                            className="p-6 cursor-pointer flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-lg shadow-sm shrink-0">
                                {userInitial}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="text-sm font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">
                                    {item.userName || item.userEmail}
                                  </h4>
                                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                    item.status === 'resolved' 
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  }`}>
                                    {item.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-md">
                                    {item.subject ? <span className="font-bold text-indigo-600 dark:text-indigo-400 mr-2 italic">{item.subject}:</span> : ''}
                                    {lastMessagePreview}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0 self-end lg:self-center">
                              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                {item.timestamp?.toDate ? new Date(item.timestamp.toDate()).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Now'}
                              </div>
                              <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                <Plus className={`w-4 h-4 transition-transform ${isExpanded ? 'active:rotate-45' : ''}`} />
                              </div>
                            </div>
                          </div>

                          {/* Expanded Content */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-8 pb-8 pl-[72px]">
                                  <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    {/* Action Buttons Hub */}
                                    <div className="flex items-center justify-between gap-4 py-2">
                                       <div className="flex items-center gap-3">
                                          {item.status !== 'resolved' && (
                                            <button 
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                  await updateDoc(doc(db, 'concerns', item.id), { status: 'resolved' });
                                                  toast.success("Concern marked as resolved.");
                                                } catch (err) {
                                                  toast.error("Failed to update status.");
                                                }
                                              }}
                                              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2"
                                            >
                                              <CheckCircle2 className="w-3.5 h-3.5" />
                                              Mark Resolved
                                            </button>
                                          )}
                                       </div>
                                       
                                       <div className="flex items-center gap-2">
                                          {isDeleting === item.id ? (
                                            <div className="flex items-center gap-1 p-1 bg-rose-50 dark:bg-rose-900/10 rounded-xl">
                                              <button 
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  try {
                                                    await deleteDoc(doc(db, 'concerns', item.id));
                                                    toast.success("Record deleted.");
                                                    setIsDeleting(null);
                                                  } catch (err) {
                                                    toast.error("Failed to delete.");
                                                  }
                                                }}
                                                className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-sm"
                                              >
                                                Confirm Delete
                                              </button>
                                              <button 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setIsDeleting(null);
                                                }}
                                                className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          ) : (
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setIsDeleting(item.id);
                                              }}
                                              className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                                              title="Delete Thread"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          )}
                                       </div>
                                    </div>

                                    {/* Message History */}
                                    <div className="space-y-4">
                                      {item.subject && (
                                        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                                          <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1 italic">Subject</p>
                                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.subject}</p>
                                        </div>
                                      )}
                                      
                                      {!item.messages && item.message && (
                                        <div className="flex justify-start">
                                          <div className="max-w-[85%] rounded-2xl px-5 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 relative">
                                            <div className="absolute -left-1.5 top-4 w-3 h-3 bg-slate-100 dark:bg-slate-800 rotate-45" />
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Initial Request</span>
                                            </div>
                                            <p className="text-sm font-medium leading-relaxed">{item.message}</p>
                                          </div>
                                        </div>
                                      )}
                                      {(item.messages || []).map((msg: any, idx: number) => (
                                        <div key={idx} className={`flex ${msg.role === 'supervisor' ? 'justify-end' : 'justify-start'}`}>
                                          <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 relative ${
                                            msg.role === 'supervisor' 
                                              ? 'bg-indigo-600 text-white shadow-md' 
                                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700'
                                          }`}>
                                            {msg.role === 'supervisor' ? (
                                              <div className="absolute -right-1.5 top-4 w-3 h-3 bg-indigo-600 rotate-45" />
                                            ) : (
                                              <div className="absolute -left-1.5 top-4 w-3 h-3 bg-white dark:bg-slate-800 border-l border-t border-slate-100 dark:border-slate-700 rotate-45" />
                                            )}
                                            <div className="flex items-center gap-4 mb-2">
                                              <span className={`text-[9px] font-black uppercase tracking-widest ${msg.role === 'supervisor' ? 'text-white/70' : 'text-slate-400'}`}>
                                                {msg.role === 'supervisor' ? 'You (Supervisor)' : (msg.senderName || item.userName || 'User')}
                                              </span>
                                              <span className={`text-[9px] ml-auto ${msg.role === 'supervisor' ? 'text-white/50' : 'text-slate-400/50'}`}>
                                                {msg.timestamp ? new Date(msg.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                              </span>
                                            </div>
                                            <p className="text-sm font-medium leading-relaxed tracking-tight break-words">{msg.text}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Reply Area */}
                                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                                      {item.status !== 'resolved' ? (
                                        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-500/10 p-4 shadow-sm space-y-4">
                                          <textarea
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder={`Message ${item.userName || 'user'}...`}
                                            className="w-full h-24 px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-sm outline-none transition-all resize-none font-medium text-slate-900 dark:text-slate-100"
                                          />
                                          <div className="flex justify-end">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSendReply(item.id);
                                              }}
                                              disabled={isSubmittingReply || !replyText.trim()}
                                              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                            >
                                              {isSubmittingReply ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                              Send Message
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-center py-4 px-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Thread Resolved</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-8">
              {/* Notification Settings Block */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <Bell className="w-6 h-6 text-amber-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Notification Settings</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-8">
                  {/* System Events */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">System Events</h4>
                    <div className="space-y-4">
                      {[
                        { key: 'onExportCSV', label: 'Export CSV', desc: 'Notify when CSV export is completed' },
                        { key: 'onNewTask', label: 'New Task Created', desc: 'Notify when a new content task is added' },
                        { key: 'onTaskDeleted', label: 'Task Deleted', desc: 'Notify when a task is permanently removed' },
                        { key: 'onNewConcern', label: 'Support Concerns', desc: 'Notify when a new user concern is submitted' },
                        { key: 'onNewSupportMessage', label: 'Support Chats', desc: 'Notify on new messages in support threads' },
                        { key: 'onDeletionRequest', label: 'Deletion Requests', desc: 'Notify when users request to delete Hub or Facebook posts' },
                        { key: 'onApprovalRequired', label: 'Approvals Required', desc: 'Notify when posts or AI content need supervisor approval' }
                      ].map(item => (
                        <div key={item.key} className="flex items-center justify-between group">
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.label}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.desc}</p>
                          </div>
                          <button 
                            onClick={() => setLocalSettings((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))}
                            className={`shrink-0 w-10 h-5 rounded-full relative transition-all duration-300 ${localSettings?.[item.key] ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${localSettings?.[item.key] ? 'right-1' : 'left-1'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status Updates */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status Updates</h4>
                    <div className="space-y-4">
                      {[
                        { key: 'onStatusScheduled', label: 'Scheduled', desc: 'Notify when content is marked as Scheduled' },
                        { key: 'onStatusReadyForReview', label: 'Ready for Review', desc: 'Notify when content is ready for approval' },
                        { key: 'onAICaption', label: 'AI Generation', desc: 'Notify when AI caption generation is finished' }
                      ].map(item => (
                        <div key={item.key} className="flex items-center justify-between group">
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.label}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.desc}</p>
                          </div>
                          <button 
                            onClick={() => setLocalSettings((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))}
                            className={`shrink-0 w-10 h-5 rounded-full relative transition-all duration-300 ${localSettings?.[item.key] ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${localSettings?.[item.key] ? 'right-1' : 'left-1'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleSaveSettings}
                  className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-primary-dark dark:text-slate-900 rounded-xl text-sm font-bold transition-all shadow-sm"
                >
                  Save Notification Settings
                </button>
              </div>

              {/* System Governance Block */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl">
                    <Shield className="w-6 h-6 text-rose-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">System Governance</h3>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between group">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        Supervisor Deletion Only
                        <Lock className="w-3.5 h-3.5 text-rose-500" />
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">When active, only users with 'Marketing Supervisor' role can delete content tasks or posts from the hub</p>
                    </div>
                    <button 
                      onClick={() => setLocalGovernanceSettings(prev => ({ ...prev, restrictDeletionToSupervisor: !prev.restrictDeletionToSupervisor }))}
                      className={`shrink-0 w-10 h-5 rounded-full relative transition-all duration-300 ${localGovernanceSettings?.restrictDeletionToSupervisor ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${localGovernanceSettings?.restrictDeletionToSupervisor ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between group pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        Approval Required for Deletion
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Regular users can request deletion, but a Supervisor must approve it before removal.</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold italic mt-1 leading-tight">Note: Supervisors are exempt and delete directly.</p>
                    </div>
                    <button 
                      onClick={() => setLocalGovernanceSettings(prev => ({ ...prev, requireDeletionApproval: !prev.requireDeletionApproval }))}
                      className={`shrink-0 w-10 h-5 rounded-full relative transition-all duration-300 ${localGovernanceSettings?.requireDeletionApproval ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${localGovernanceSettings?.requireDeletionApproval ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between group pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        Approval Required for Facebook Deletion
                        <Clock className="w-3.5 h-3.5 text-rose-500" />
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Regular users must request permission from a Supervisor to delete posts from Facebook.</p>
                    </div>
                    <button 
                      onClick={() => setLocalGovernanceSettings(prev => ({ ...prev, requireFacebookDeletionApproval: !prev.requireFacebookDeletionApproval }))}
                      className={`shrink-0 w-10 h-5 rounded-full relative transition-all duration-300 ${localGovernanceSettings?.requireFacebookDeletionApproval ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${localGovernanceSettings?.requireFacebookDeletionApproval ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="mt-8">
                  <button 
                    onClick={handleSaveGovernanceSettings}
                    className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl text-sm font-bold transition-all shadow-sm"
                  >
                    Save Governance Settings
                  </button>
                </div>
              </div>

              {/* CSV Export Settings Block */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <Download className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">CSV Export Configuration</h3>
                </div>

                <div className="mb-8">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                    Select which columns should be included in the CSV export and import template:
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[
                      { key: 'date', label: 'Date' },
                      { key: 'contentTitle', label: 'Title' },
                      { key: 'contentType', label: 'Type' },
                      { key: 'topicTheme', label: 'Theme' },
                      { key: 'subtopic', label: 'Subtopic' },
                      { key: 'caption', label: 'Caption' },
                      { key: 'format', label: 'Format' },
                      { key: 'status', label: 'Status' },
                      { key: 'funnelStatus', label: 'Funnel' },
                      { key: 'visualIdeas', label: 'Visual Ideas' },
                      { key: 'notes', label: 'Notes' },
                      { key: 'approvalStatus', label: 'Approval' }
                    ].map(item => (
                      <label 
                        key={item.key} 
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          localExportSettings?.[item.key] 
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100' 
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                          localExportSettings?.[item.key] ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700'
                        }`}>
                          {localExportSettings?.[item.key] && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={localExportSettings?.[item.key] || false}
                          onChange={() => setLocalExportSettings((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))}
                        />
                        <span className="text-sm font-bold">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => {
                    onUpdateExportSettings(localExportSettings);
                    addNotification('Export Settings Updated', 'CSV export configuration has been saved.', 'success');
                  }}
                  className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
                >
                  Save Export Configuration
                </button>
              </div>

              {/* Social Redirection Block */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                    <ExternalLink className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Social Media Redirection Links</h3>
                </div>

                <div className="space-y-8">
                  {/* Select Platforms Subsection */}
                  <div className="col-span-1 md:col-span-2 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Select Platforms</h4>
                    <div className="flex flex-wrap gap-3">
                      {SUPPORTED_SOCIAL_PLATFORMS.map((platform) => {
                        const Icon = platform.icon;
                        const isActive = platform.id in localSocialLinks;
                        
                        return (
                          <button
                            key={platform.id}
                            onClick={() => handleTogglePlatform(platform.id)}
                            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 transition-all duration-300 ${
                              isActive 
                                ? 'bg-white dark:bg-slate-900 border-indigo-500 text-slate-900 dark:text-white shadow-md' 
                                : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                              <Icon 
                                className="w-4 h-4" 
                                style={{ color: isActive ? platform.color : undefined }}
                              />
                            </div>
                            <span className="text-sm font-bold">{platform.label}</span>
                            {isActive ? (
                              <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                            ) : (
                              <PlusCircle className="w-4 h-4 opacity-40" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <AnimatePresence mode="popLayout">
                      {SUPPORTED_SOCIAL_PLATFORMS.filter(p => p.id in localSocialLinks).map((platform) => {
                        const Icon = platform.icon;
                        return (
                          <motion.div
                            key={platform.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="space-y-1.5"
                          >
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              <Icon className="w-3 h-3" style={{ color: platform.color }} />
                              {platform.label} URL
                            </label>
                            <div className="group relative">
                              <input 
                                type="url" 
                                placeholder={`https://${platform.id}.com/yourpage`}
                                value={localSocialLinks[platform.id] || ''}
                                onChange={(e) => setLocalSocialLinks(prev => ({ ...prev, [platform.id]: e.target.value }))}
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100 transition-all"
                              />
                              <button 
                                onClick={() => handleTogglePlatform(platform.id)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove Link"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    
                    {Object.keys(localSocialLinks).length === 0 && (
                      <div className="col-span-1 md:col-span-2 py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <Share2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-relaxed"> No Platforms Selected</h4>
                        <p className="text-[11px] text-slate-500 mt-1">Select social media icons above to add links to your portal.</p>
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => onUpdateSocialLinks(localSocialLinks)}
                  className="mt-8 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
                >
                  Save Social Links
                </button>
              </div>

              {/* System Backup & Restore Block */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                    <History className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">System Backup & Restore</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2 flex items-center gap-2">
                       <Download className="w-4 h-4 text-purple-500" />
                       Full System Backup
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed font-medium">
                      Generates a complete JSON snapshot of all system-critical collections including posts, users, notifications, and settings.
                    </p>
                    <button 
                      onClick={onBackupData}
                      className="w-full py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                    >
                      Export Backup (JSON)
                    </button>
                  </div>

                  <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2 flex items-center gap-2">
                       <Upload className="w-4 h-4 text-orange-500" />
                       Restore from Backup
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed font-medium">
                      Upload a previously exported JSON backup to restore system state. <span className="text-orange-600 dark:text-orange-400 font-bold">Warning: Overwrites matching records.</span>
                    </p>
                    <button 
                      onClick={() => document.getElementById('admin-backup-restore-input')?.click()}
                      className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload & Restore
                    </button>
                    <input 
                      type="file" 
                      id="admin-backup-restore-input" 
                      className="hidden" 
                      accept=".json" 
                      onChange={onRestoreData} 
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                   <div className="flex items-start gap-4 p-4 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/20">
                      <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h5 className="text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest mb-1">Legacy Restore Tool</h5>
                        <p className="text-[11px] text-rose-600/80 dark:text-rose-400/60 leading-relaxed font-medium mb-3">
                          Permanently deletes all marketing requests, comments, activity logs, and notifications to reset the hub state. User accounts are preserved.
                        </p>
                        
                        {!showResetVerify ? (
                          <button 
                            onClick={() => setShowResetVerify(true)}
                            disabled={isSeeding}
                            className="px-4 py-2 bg-white dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/40 rounded-lg text-[10px] font-black text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all shadow-sm disabled:opacity-50 uppercase tracking-widest"
                          >
                            {isSeeding ? 'Processing...' : 'Run Quick Reset'}
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <div className="p-3 bg-white dark:bg-slate-900/50 rounded-xl border border-rose-200 dark:border-rose-900/30">
                              <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2">
                                Type <span className="text-rose-900 dark:text-rose-200 bg-rose-100 dark:bg-rose-900/40 px-1.5 py-0.5 rounded">RESET</span> to confirm destruction
                              </p>
                              <input 
                                type="text"
                                value={resetConfirmText}
                                onChange={(e) => setResetConfirmText(e.target.value)}
                                placeholder="Type here..."
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 placeholder:text-rose-300 dark:placeholder:text-rose-900/40"
                                autoFocus
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  if (resetConfirmText === 'RESET') {
                                    onRestore();
                                    setShowResetVerify(false);
                                    setResetConfirmText('');
                                  } else {
                                    toast.error("Incorrect verification text.");
                                  }
                                }}
                                disabled={isSeeding || resetConfirmText !== 'RESET'}
                                className="px-5 py-2 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-sm disabled:opacity-30 disabled:grayscale"
                              >
                                Confirm Destructive Reset
                              </button>
                              <button 
                                onClick={() => {
                                  setShowResetVerify(false);
                                  setResetConfirmText('');
                                }}
                                disabled={isSeeding}
                                className="px-5 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                   </div>
                </div>
              </div>

              {/* App Info Block */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <Info className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">App Info</h3>
                </div>

                <div className="space-y-8">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Application Name</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Marketing Operations Portal</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500/30 transition-all group">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Active Database</p>
                      </div>
                      <p className="text-base font-black text-slate-900 dark:text-slate-100 mb-2 truncate">marketing-43c62</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        The primary high-performance project used for real-time Firestore data, User Authentication, and application assets. This is the heart of the operational hub.
                      </p>
                    </div>

                    <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-emerald-500/30 transition-all group">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <p className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest">Provisioned Runtime</p>
                      </div>
                      <p className="text-base font-black text-slate-900 dark:text-slate-100 mb-2 truncate">gen-lang-client-0116256991</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        The host project provisioned by AI Studio. It manages the runtime environment, deployment quotas, and secure access to Google GenAI capabilities.
                      </p>
                    </div>

                    <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-[#1877F2]/30 transition-all group">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${fbPageInfo ? 'bg-[#1877F2] animate-pulse' : 'bg-slate-300'}`} />
                        <p className="text-[10px] font-black text-[#1877F2] uppercase tracking-widest">Meta Integration</p>
                      </div>
                      <p className="text-base font-black text-slate-900 dark:text-slate-100 mb-2 truncate">
                        {isLoadingFBInfo ? 'Loading...' : fbPageInfo?.name || 'Not Connected'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        {fbPageInfo 
                          ? `Linked to Facebook Page "${fbPageInfo.name}". This connection enables automated publishing and scheduling of social content.`
                          : 'No Facebook Page is currently linked. Connect a page in the Social Redirection Links section to enable automated publishing.'}
                      </p>
                    </div>

                    <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-pink-500/30 transition-all group">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${fbPageInfo?.instagram_business_account ? 'bg-pink-500 animate-pulse' : 'bg-slate-300'}`} />
                        <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest">Instagram Business</p>
                      </div>
                      <p className="text-base font-black text-slate-900 dark:text-slate-100 mb-2 truncate">
                        {isLoadingFBInfo ? 'Loading...' : fbPageInfo?.instagram_business_account?.username ? `@${fbPageInfo.instagram_business_account.username}` : 'Not Linked'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        {fbPageInfo?.instagram_business_account
                          ? `Connected to Instagram Business account "${fbPageInfo.instagram_business_account.name}". Publishing to IG is managed through your linked FB Page.`
                          : 'No Instagram Business account detected for the linked Facebook Page. Ensure your IG account is set to Business and linked in Meta Business Suite.'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs italic text-slate-400 dark:text-slate-500">Settings are only accessible to Marketing Supervisors.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'links' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <ExternalLink className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Quick Links Management</h3>
              </div>
              
              <div className="space-y-4">
                {localQuickLinks.map((link, index) => (
                  <div key={link.id} className="flex flex-col md:flex-row gap-4 items-end p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 transition-colors duration-300">
                    <div className="flex-1 w-full space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Link Name</label>
                      <input 
                        type="text" 
                        value={link.name}
                        onChange={(e) => {
                          const newLinks = [...localQuickLinks];
                          newLinks[index].name = e.target.value;
                          setLocalQuickLinks(newLinks);
                        }}
                        placeholder="e.g. Brand Guidelines"
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div className="flex-[2] w-full space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">URL</label>
                      <input 
                        type="text" 
                        value={link.url}
                        onChange={(e) => {
                          const newLinks = [...localQuickLinks];
                          newLinks[index].url = e.target.value;
                          setLocalQuickLinks(newLinks);
                        }}
                        placeholder="https://..."
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <button 
                      onClick={() => setLocalQuickLinks(prev => prev.filter((_, i) => i !== index))}
                      className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                      title="Remove Link"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                
                <button 
                  onClick={() => setLocalQuickLinks(prev => [...prev, { id: Date.now().toString(), name: '', url: '#' }])}
                  className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 dark:text-slate-500 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-all flex items-center justify-center gap-2 group"
                >
                  <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold tracking-tight">Add New Link</span>
                </button>
              </div>
              
              <div className="mt-8 flex flex-col md:flex-row items-center gap-4">
                {!showLinksConfirm ? (
                  <button 
                    onClick={() => setShowLinksConfirm(true)}
                    className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-primary-dark dark:text-slate-900 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2"
                  >
                    {linksUpdateSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        Links Updated
                      </>
                    ) : (
                      'Update Quick Links'
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 transition-colors duration-300">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 px-4">Confirm changes?</span>
                    <button 
                      onClick={handleUpdateQuickLinks}
                      disabled={isUpdatingLinks}
                      className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {isUpdatingLinks ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Yes, Save
                    </button>
                    <button 
                      onClick={() => setShowLinksConfirm(false)}
                      className="px-6 py-2 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-lg text-sm font-bold transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                
                {linksUpdateSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-emerald-600 font-bold text-sm"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    Successfully updated!
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
