//
// File: CampaignsListView.tsx
// Author: Juan Dela Cruz
// Date: 2026-06-09
// Purpose: Renders and manages the active email campaigns collection, with tools for searching, deleting, scheduling, duplicating, and force execution
//

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Send, 
  Trash2, 
  Edit2, 
  Plus, 
  Search, 
  Eye, 
  Copy, 
  Calendar, 
  MoreVertical, 
  AlertCircle,
  FileCode,
  CheckCircle,
  HelpCircle,
  Clock,
  X,
  Play,
  CheckSquare,
  Download
} from 'lucide-react';
import { collection, onSnapshot, deleteDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { EmailCampaign } from '../types';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface CampaignsListViewProps {
  onNavigate: (view: any, data?: any) => void;
  userRole: string;
}

export const CampaignsListView: React.FC<CampaignsListViewProps> = ({ onNavigate, userRole }) => {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [isBulkModeActive, setIsBulkModeActive] = useState(false);
  const [triggeringScheduler, setTriggeringScheduler] = useState(false);
  const [isForceSending, setIsForceSending] = useState(false);

  const [schedulerReport, setSchedulerReport] = useState<any | null>(null);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);

  const handleForceSend = async (campaignId: string) => {
    setIsForceSending(true);
    const loadingToast = toast.loading('Force dispatching scheduled campaign...');
    try {
      const resp = await axios.get(`/api/cron?forceCampaignId=${campaignId}`);
      const data = resp.data;
      if (data.success) {
        const triggered = data.triggeredCampaigns || [];
        if (triggered.length > 0) {
          toast.success('Campaign dispatch finished successfully!', { id: loadingToast, duration: 4000 });
        } else {
          toast.success('Successfully finished checking/sending the campaign!', { id: loadingToast, duration: 4000 });
        }
      } else {
        toast.error(`Force dispatch failed: ${data.message || 'Unknown error'}`, { id: loadingToast });
      }
    } catch (e: any) {
      const errorMsg = e.response?.data?.message || e.message;
      toast.error(`Force dispatch error: ${errorMsg}`, { id: loadingToast });
    } finally {
      setIsForceSending(false);
    }
  };

  const handleTriggerScheduler = async () => {
    setTriggeringScheduler(true);
    const loadingToast = toast.loading('Synchronizing scheduler and checking for due campaigns...');
    try {
      const resp = await axios.get('/api/cron?force=true');
      const data = resp.data;
      setSchedulerReport(data);
      if (data.success) {
        const triggered = data.triggeredCampaigns || [];
        if (triggered.length > 0) {
          toast.success(`Success! Sent ${triggered.length} campaign(s): ${triggered.map((c: any) => c.title).join(', ')}`, { id: loadingToast, duration: 6000 });
        } else {
          toast.success('Sync complete! All scheduled campaigns are up-to-date; none are due yet.', { id: loadingToast, duration: 4500 });
        }
      } else {
        toast.error(`Sync failed: ${data.message || 'Unknown error'}`, { id: loadingToast });
      }
    } catch (e: any) {
      const errorMsg = e.response?.data?.message || e.message;
      toast.error(`Failed to trigger sync: ${errorMsg}`, { id: loadingToast });
    } finally {
      setTriggeringScheduler(false);
    }
  };

  const runDiagnostics = async () => {
    setRunningDiagnostics(true);
    const loadingToast = toast.loading('Running scheduler diagnostics and syncing campaigns...');
    try {
      const resp = await axios.get('/api/cron?force=true');
      setSchedulerReport(resp.data);
      setShowDiagnosticModal(true);
      toast.success('Diagnostics populated successfully.', { id: loadingToast });
    } catch (e: any) {
      const errorMsg = e.response?.data?.message || e.message;
      if (e.response?.data) {
        setSchedulerReport(e.response.data);
        setShowDiagnosticModal(true);
        toast.error(`Diagnostics loaded with alerts: ${errorMsg}`, { id: loadingToast });
      } else {
        toast.error(`Diagnostics failed: ${errorMsg}`, { id: loadingToast });
      }
    } finally {
      setRunningDiagnostics(false);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'emailCampaigns'), (snapshot) => {
      const list: EmailCampaign[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...(doc.data() as EmailCampaign), id: doc.id });
      });
      // Sort by createdAt desc
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCampaigns(list);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching campaigns:", err);
    });

    return () => unsub();
  }, []);

  const handleDelete = async (campaignId: string) => {
    if (!window.confirm("Are you sure you want to delete this campaign permanently?")) return;
    try {
      await deleteDoc(doc(db, 'emailCampaigns', campaignId));
      setSelectedCampaignIds(prev => prev.filter(id => id !== campaignId));
      toast.success("Campaign deleted");
    } catch (e: any) {
      toast.error(`Error deleting: ${e.message}`);
    }
  };

  const handleDuplicate = async (campaign: EmailCampaign) => {
    try {
      const duplicated: Omit<EmailCampaign, 'id'> = {
        title: `${campaign.title} (Copy)`,
        subject: campaign.subject,
        body: campaign.body,
        status: 'draft',
        type: campaign.type,
        recipientTags: Array.isArray(campaign.recipientTags) ? campaign.recipientTags : [],
        sentCount: 0,
        failedCount: 0,
        createdBy: auth.currentUser?.email || 'System',
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'emailCampaigns'), duplicated);
      toast.success("Campaign duplicated into draft!");
    } catch (e: any) {
      toast.error("Duplicate failed");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCampaignIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete the ${selectedCampaignIds.length} selected campaigns permanently?`)) return;

    const loadingToast = toast.loading(`Deleting ${selectedCampaignIds.length} campaigns...`);
    try {
      await Promise.all(selectedCampaignIds.map(id => deleteDoc(doc(db, 'emailCampaigns', id))));
      setSelectedCampaignIds([]);
      toast.success("Selected campaigns deleted successfully", { id: loadingToast });
    } catch (e: any) {
      toast.error(`Bulk delete failed: ${e.message}`, { id: loadingToast });
    }
  };

  const handleBulkDuplicate = async () => {
    if (selectedCampaignIds.length === 0) return;
    if (!window.confirm(`Duplicate ${selectedCampaignIds.length} selected campaigns into drafts?`)) return;

    const loadingToast = toast.loading(`Duplicating ${selectedCampaignIds.length} campaigns...`);
    try {
      const selectedList = campaigns.filter(c => selectedCampaignIds.includes(c.id));
      await Promise.all(selectedList.map(campaign => {
        const duplicated: Omit<EmailCampaign, 'id'> = {
          title: `${campaign.title} (Copy)`,
          subject: campaign.subject,
          body: campaign.body,
          status: 'draft',
          type: campaign.type,
          recipientTags: Array.isArray(campaign.recipientTags) ? campaign.recipientTags : [],
          sentCount: 0,
          failedCount: 0,
          createdBy: auth.currentUser?.email || 'System',
          createdAt: new Date().toISOString()
        };
        return addDoc(collection(db, 'emailCampaigns'), duplicated);
      }));
      setSelectedCampaignIds([]);
      toast.success(`Successfully duplicated ${selectedList.length} campaigns!`, { id: loadingToast });
    } catch (e: any) {
      toast.error(`Bulk duplicate failed: ${e.message}`, { id: loadingToast });
    }
  };

  const handleBulkStatusChange = async (newStatus: 'draft' | 'sent' | 'scheduled') => {
    if (selectedCampaignIds.length === 0) return;
    const loadingToast = toast.loading(`Updating ${selectedCampaignIds.length} campaigns to ${newStatus}...`);
    try {
      await Promise.all(selectedCampaignIds.map(id => {
        const payload: any = { status: newStatus };
        if (newStatus === 'sent') {
          payload.sentAt = new Date().toISOString();
        }
        return updateDoc(doc(db, 'emailCampaigns', id), payload);
      }));
      setSelectedCampaignIds([]);
      toast.success(`Updated status to ${newStatus}!`, { id: loadingToast });
    } catch (e: any) {
      toast.error(`Failed to update status: ${e.message}`, { id: loadingToast });
    }
  };

  const handleBulkDownload = () => {
    if (selectedCampaignIds.length === 0) return;

    const selectedList = campaigns.filter(c => selectedCampaignIds.includes(c.id));
    
    // Define CSV columns
    const headers = [
      'ID',
      'Title',
      'Subject',
      'Type',
      'Status',
      'Recipient Tags',
      'Sent Count',
      'Failed Count',
      'Created By',
      'Created At',
      'Scheduled At',
      'Sent At'
    ];
    
    // Escape helper to safely format strings for CSV
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    const rows = selectedList.map(campaign => [
      campaign.id,
      campaign.title,
      campaign.subject,
      campaign.type,
      campaign.status,
      Array.isArray(campaign.recipientTags) ? campaign.recipientTags.join(', ') : '',
      campaign.sentCount || 0,
      campaign.failedCount || 0,
      campaign.createdBy,
      campaign.createdAt,
      campaign.scheduledAt || '',
      campaign.sentAt || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');
    
    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `selected_campaigns_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Downloaded metadata for ${selectedList.length} campaign(s)!`);
  };

  const filteredCampaigns = campaigns.filter(c => 
    c.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectAll = () => {
    const visibleIds = filteredCampaigns.map(c => c.id);
    const allVisibleSelected = visibleIds.every(id => selectedCampaignIds.includes(id));
    if (allVisibleSelected) {
      setSelectedCampaignIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedCampaignIds(prev => {
        const union = new Set([...prev, ...visibleIds]);
        return Array.from(union);
      });
    }
  };

  const isAllVisibleSelected = filteredCampaigns.length > 0 && filteredCampaigns.map(c => c.id).every(id => selectedCampaignIds.includes(id));
  const isAnyVisibleSelected = filteredCampaigns.length > 0 && filteredCampaigns.map(c => c.id).some(id => selectedCampaignIds.includes(id));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-transparent">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Email Campaigns</h2>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleTriggerScheduler}
            disabled={triggeringScheduler}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/85 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-lg text-sm shadow-sm transition-all disabled:opacity-50"
            style={{ height: '42px' }}
          >
            <Clock className={`w-4 h-4 ${triggeringScheduler ? 'animate-spin' : ''}`} />
            {triggeringScheduler ? 'Syncing...' : 'Sync Scheduler'}
          </button>
          <button
            onClick={runDiagnostics}
            disabled={runningDiagnostics || triggeringScheduler}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/85 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-lg text-sm shadow-sm transition-all disabled:opacity-50"
            style={{ height: '42px' }}
          >
            <FileCode className={`w-4 h-4 ${runningDiagnostics ? 'animate-pulse text-amber-500' : ''}`} />
            Diagnostics
          </button>
          <button
            onClick={() => onNavigate('compose')}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg text-sm shadow transition-all"
            style={{ height: '42px' }}
          >
            <Plus className="w-4 h-4" /> Create Campaign
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search campaigns by title, subject, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {isBulkModeActive && selectedCampaignIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="bg-amber-500 text-white font-bold p-1 px-2.5 rounded-lg text-xs leading-none">
                  {selectedCampaignIds.length}
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                  campaigns selected from the list
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={handleBulkDuplicate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Duplicate Copies
                </button>

                <button
                  onClick={handleBulkDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download Selection
                </button>

                <div className="relative group">
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-xs transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" /> Mark Status...
                  </button>
                  <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg shadow-lg py-1 hidden group-hover:block hover:block z-20">
                    <button
                      onClick={() => handleBulkStatusChange('draft')}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium cursor-pointer"
                    >
                      Draft
                    </button>
                    <button
                      onClick={() => handleBulkStatusChange('sent')}
                      className="w-full text-left px-3 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 font-medium cursor-pointer"
                    >
                      Sent
                    </button>
                    <button
                      onClick={() => handleBulkStatusChange('scheduled')}
                      className="w-full text-left px-3 py-1.5 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 font-medium cursor-pointer"
                    >
                      Scheduled
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/10 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
                </button>

                <button
                  onClick={() => setSelectedCampaignIds([])}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 transition-colors cursor-pointer"
                  title="Clear choice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop campaigns Table / List cards */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {/* Table Header Controls */}
        <div className="px-5 py-3 border-b border-slate-150 dark:border-slate-805 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Campaign List</span>
          <button
            type="button"
            title={isBulkModeActive ? "Exit Selection Mode" : "Enable Bulk Selection"}
            onClick={() => {
              const nextMode = !isBulkModeActive;
              setIsBulkModeActive(nextMode);
              if (!nextMode) {
                setSelectedCampaignIds([]);
              }
            }}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isBulkModeActive
                ? 'bg-amber-50 border-amber-400 text-amber-600 dark:bg-amber-950/20 dark:border-amber-500 dark:text-amber-400'
                : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <CheckSquare className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                {isBulkModeActive && (
                  <th className="px-6 py-4 w-12">
                    <input
                      type="checkbox"
                      checked={isAllVisibleSelected}
                      ref={el => {
                        if (el) {
                          el.indeterminate = isAnyVisibleSelected && !isAllVisibleSelected;
                        }
                      }}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Filters</th>
                <th className="px-6 py-4 text-center">Outcome</th>
                <th className="px-6 py-4">Created Date</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={isBulkModeActive ? 8 : 7} className="px-6 py-12 text-center text-slate-400">Loading campaign list...</td>
                </tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={isBulkModeActive ? 8 : 7} className="px-6 py-12 text-center text-slate-400">No campaigns found matching search criteria.</td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => (
                  <tr 
                    key={campaign.id} 
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 cursor-pointer transition-colors"
                    onClick={() => {
                      if (campaign.status === 'draft') {
                        onNavigate('compose', campaign);
                      } else {
                        setSelectedCampaign(campaign);
                      }
                    }}
                  >
                    {isBulkModeActive && (
                      <td className="px-6 py-4 w-12" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedCampaignIds.includes(campaign.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCampaignIds(prev => [...prev, campaign.id]);
                            } else {
                              setSelectedCampaignIds(prev => prev.filter(id => id !== campaign.id));
                            }
                          }}
                          className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                      <div className="flex flex-col">
                        <span>{campaign.title}</span>
                        <span className="text-xs text-slate-400 font-normal max-w-sm truncate">{campaign.subject}</span>
                        {campaign.status === 'scheduled' && campaign.scheduledAt && (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                            ⏱️ Scheduled for {new Date(campaign.scheduledAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        campaign.type === 'Newsletter' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20' :
                        campaign.type === 'Promotion' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {campaign.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        campaign.status === 'sent' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30' :
                        campaign.status === 'sending' ? 'bg-blue-100 text-blue-800 animate-pulse' :
                        campaign.status === 'scheduled' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate">
                      {Array.isArray(campaign.recipientTags) && campaign.recipientTags.length > 0 ? (
                        <div className="flex gap-1 overflow-hidden">
                          {campaign.recipientTags.map(tag => (
                            <span key={tag} className="bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 text-[10px] px-1.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">All active contacts</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-xs">
                        <span className="font-semibold text-emerald-600">{campaign.sentCount || 0} sent</span>
                        {campaign.failedCount > 0 && (
                          <span className="text-red-500 font-medium ml-2">{campaign.failedCount} failed</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(campaign.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCampaign(campaign);
                          }}
                          className="p-1 px-2.5 rounded text-slate-500 bg-slate-50 hover:bg-slate-150 text-xs font-bold transition-all flex items-center gap-1"
                          title="View layout"
                        >
                          <Eye className="w-3.5 h-3.5" /> View HTML
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(campaign);
                          }}
                          className="p-1 text-indigo-500 hover:bg-indigo-50 rounded"
                          title="Duplicate draft"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        {campaign.status === 'draft' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate('compose', campaign);
                            }}
                            className="p-1 text-amber-500 hover:bg-amber-50 rounded"
                            title="Edit campaign"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(campaign.id);
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          title="Delete Campaign"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* HTML Content Viewer Drawer/Modal */}
      {selectedCampaign && (() => {
        const activeCampaignInModal = campaigns.find(c => c.id === selectedCampaign.id) || selectedCampaign;
        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white">{activeCampaignInModal.title}</h3>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      activeCampaignInModal.status === 'sent' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30' :
                      activeCampaignInModal.status === 'sending' ? 'bg-blue-100 text-blue-800 animate-pulse' :
                      activeCampaignInModal.status === 'scheduled' ? 'bg-amber-100 text-amber-800 font-medium' :
                      activeCampaignInModal.status === 'failed' ? 'bg-rose-100 text-rose-800 font-medium' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {activeCampaignInModal.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Subject: <strong>{activeCampaignInModal.subject}</strong></p>
                  
                  {activeCampaignInModal.scheduledAt && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-medium">
                      ⏱️ Scheduled: {new Date(activeCampaignInModal.scheduledAt).toLocaleString()}
                    </p>
                  )}
                  {(activeCampaignInModal.sentCount > 0 || activeCampaignInModal.failedCount > 0) && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Progress: <span className="text-emerald-600 font-semibold">{activeCampaignInModal.sentCount || 0} sent</span>
                      {activeCampaignInModal.failedCount > 0 && <span className="text-rose-500 font-semibold ml-2">{activeCampaignInModal.failedCount} failed</span>}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedCampaign(null)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950 prose dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: activeCampaignInModal.body }} />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center gap-2 text-xs">
                <span className="text-slate-400 mr-auto flex items-center gap-1">
                  <FileCode className="w-4 h-4" /> HTML Rendering
                </span>
                
                {(activeCampaignInModal.status === 'scheduled' || activeCampaignInModal.status === 'failed') && (
                  <button
                    type="button"
                    id="btn-force-trigger-send"
                    disabled={isForceSending || activeCampaignInModal.status === 'sending'}
                    onClick={() => handleForceSend(activeCampaignInModal.id)}
                    className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                      isForceSending 
                        ? 'bg-amber-200 text-amber-800 cursor-not-allowed dark:bg-amber-950/40 dark:text-amber-400' 
                        : 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-sm hover:shadow dark:bg-amber-600 dark:hover:bg-amber-500'
                    }`}
                  >
                    <Send className={`w-3.5 h-3.5 ${isForceSending ? 'animate-bounce' : ''}`} />
                    {isForceSending ? 'Sending...' : 'Force Trigger Send'}
                  </button>
                )}

                <button
                  onClick={() => setSelectedCampaign(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Scheduler Diagnostics Modal */}
      {showDiagnosticModal && schedulerReport && (
        <div id="scheduler-diagnostic-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto font-sans">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[85vh] animate-fade-in">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-xl">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
                  Scheduler Diagnostics & Dispatch Report
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time status check for database, keys, and scheduled campaigns
                </p>
              </div>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-900 dark:text-slate-100 bg-slate-50/30 dark:bg-slate-900/30">
              
              {/* Core Environments & Connection Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Firebase Connection Card */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-3 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-emerald-500" /> Firebase Platform Config
                  </h4>
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Project ID:</span>
                      <span className="text-slate-900 dark:text-slate-350 font-semibold">{schedulerReport.environmentVariables?.VITE_FIREBASE_PROJECT_ID || 'PENDING'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">API Key:</span>
                      <span className="text-slate-900 dark:text-slate-350">{schedulerReport.environmentVariables?.VITE_FIREBASE_API_KEY || 'MISSING'}</span>
                    </div>
                  </div>
                </div>

                {/* Gmail API Connection Card */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-3 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-amber-500" /> Gmail OAuth Status
                  </h4>
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Connected:</span>
                      <span className={`font-semibold ${schedulerReport.gmailConfig?.connected ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {schedulerReport.gmailConfig?.connected ? '✅ YES' : '❌ NO'}
                      </span>
                    </div>
                    {schedulerReport.gmailConfig?.connected && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Authorized:</span>
                        <span className="text-slate-900 dark:text-slate-350 text-right max-w-[150px] truncate">{schedulerReport.gmailConfig?.authorizedEmail || 'None'}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Client Credentials:</span>
                      <span className="text-slate-900 dark:text-slate-350">
                        {schedulerReport.environmentVariables?.GMAIL_CLIENT_ID !== 'MISSING' ? '✅ LOADED' : '❌ MISSING'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Time Diagnostics */}
              <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-wrap justify-between items-center text-xs text-slate-500 dark:text-slate-400 font-mono gap-2">
                <div>Backend Server Time: <span className="text-slate-900 dark:text-slate-350 font-medium font-mono">{schedulerReport.currentTime ? new Date(schedulerReport.currentTime).toLocaleString() : 'N/A'}</span></div>
                <div>Server Zone Offset: <span className="text-slate-900 dark:text-slate-350 font-medium font-mono">UTC (+00:00)</span></div>
              </div>

              {/* Campaign Check details list */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Campaign Verification Scan (Checked {schedulerReport.campaignsChecked || 0})
                </h4>
                {schedulerReport.details && schedulerReport.details.length > 0 ? (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950 shadow-sm">
                    {schedulerReport.details.map((campaign: any) => (
                      <div key={campaign.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                            {campaign.title} 
                            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {campaign.status}
                            </span>
                          </p>
                          <p className="text-slate-400 font-mono">
                            Document ID: {campaign.id}
                          </p>
                          {campaign.scheduledAt && (
                            <p className="text-slate-500 font-mono">
                              Scheduled For: {new Date(campaign.scheduledAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="md:text-right max-w-sm">
                          <p className={`p-1.5 rounded-lg border text-[11px] font-mono leading-relaxed inline-block ${
                            campaign.reason.includes("TRIGGERED") || campaign.reason.includes("successfully") 
                              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/55 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400"
                              : campaign.reason.includes("Waiting")
                                ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200/55 dark:border-amber-800/40 text-amber-700 dark:text-amber-400"
                                : "bg-rose-50 dark:bg-rose-950/20 border-rose-200/55 dark:border-rose-800/40 text-rose-700 dark:text-rose-400"
                          }`}>
                            {campaign.reason}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-500 italic">
                    No campaigns checked during this run. List is empty.
                  </div>
                )}
              </div>

              {/* Execution Debug logs */}
              {schedulerReport.debugLogs && schedulerReport.debugLogs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Server Execution Logs
                  </h4>
                  <div className="p-4 bg-slate-950 text-emerald-400 border border-slate-800 rounded-xl font-mono text-xs max-h-44 overflow-y-auto space-y-1.5 shadow-inner">
                    {schedulerReport.debugLogs.map((log: string, idx: number) => (
                      <p key={idx} className="leading-relaxed break-all font-mono">
                        {log}
                      </p>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center rounded-b-xl gap-2 text-xs">
              <span className="text-slate-400 flex items-center gap-1 font-mono">
                <CheckCircle className={`w-4 h-4 ${schedulerReport.success ? 'text-emerald-500' : 'text-rose-500'}`} />
                Execution Code: {schedulerReport.success ? '200' : '500'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={runDiagnostics}
                  disabled={runningDiagnostics || triggeringScheduler}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold cursor-pointer shadow-sm shadow-amber-500/10 font-sans disabled:opacity-50"
                >
                  {runningDiagnostics ? "Re-running..." : "Refresh Diagnostic"}
                </button>
                <button
                  onClick={() => setShowDiagnosticModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold font-sans transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
