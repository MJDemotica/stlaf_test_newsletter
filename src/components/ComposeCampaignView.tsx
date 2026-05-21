import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Save, 
  Eye, 
  Code, 
  Users, 
  Calendar, 
  Mail, 
  Info, 
  Check, 
  Sparkles, 
  X, 
  FileText,
  Paperclip,
  Trash2,
  Image
} from 'lucide-react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { EmailCampaign, Subscriber, EmailTemplate } from '../types';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface ComposeCampaignViewProps {
  onNavigate: (view: any) => void;
  initialCampaign?: EmailCampaign | null;
}

function parseTags(tagsVal: any): string[] {
  if (Array.isArray(tagsVal)) {
    return tagsVal;
  }
  if (typeof tagsVal === 'string') {
    if (!tagsVal.trim()) return [];
    try {
      const parsed = JSON.parse(tagsVal);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
      return [String(parsed)];
    } catch {
      return tagsVal.split(',').map((t: string) => t.trim()).filter(Boolean);
    }
  }
  return [];
}

export const ComposeCampaignView: React.FC<ComposeCampaignViewProps> = ({ onNavigate, initialCampaign }) => {
  const [title, setTitle] = useState(initialCampaign?.title || '');
  const [subject, setSubject] = useState(initialCampaign?.subject || '');
  const [type, setType] = useState<EmailCampaign['type']>(initialCampaign?.type || 'Newsletter');
  const [body, setBody] = useState(initialCampaign?.body || '');
  const [recipientTags, setRecipientTags] = useState<string[]>(Array.isArray(initialCampaign?.recipientTags) ? initialCampaign.recipientTags : []);
  const [sendType, setSendType] = useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [attachments, setAttachments] = useState<{ name: string; type: string; size: number; content: string }[]>(() => {
    if (initialCampaign?.attachmentsJson) {
      try {
        return JSON.parse(initialCampaign.attachmentsJson);
      } catch (e) {
        console.error("Error parsing campaign attachments:", e);
      }
    }
    return [];
  });
  
  // Available subscriber tags
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  // Loaded templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  // Preview toggle
  const [previewMode, setPreviewMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);

  useEffect(() => {
    // Fetch subscribers to get all tags and determine recipient counts
    const fetchSubscribersAndTemplates = async () => {
      try {
        const subSnapshot = await getDocs(collection(db, 'subscribers'));
        const subList: Subscriber[] = [];
        const tagsSet = new Set<string>();
        subSnapshot.forEach(doc => {
          const s = doc.data() as Subscriber;
          const parsedTags = parseTags(s.tags);
          subList.push({ ...s, tags: parsedTags, id: doc.id });
          parsedTags.forEach(t => tagsSet.add(t));
        });
        setSubscribers(subList);
        setAvailableTags(Array.from(tagsSet));

        const tempSnapshot = await getDocs(collection(db, 'emailTemplates'));
        const tempList: EmailTemplate[] = [];
        tempSnapshot.forEach(doc => {
          tempList.push({ ...(doc.data() as EmailTemplate), id: doc.id });
        });
        setTemplates(tempList);
      } catch (e) {
        console.error("Error loaded composition references", e);
      }
    };
    fetchSubscribersAndTemplates();
  }, []);

  const handleApplyTemplate = (temp: EmailTemplate) => {
    setSubject(temp.subject);
    setBody(temp.body);
    toast.success(`Applied template: ${temp.name}`);
  };

  const handleTagToggle = (tag: string) => {
    if (recipientTags.includes(tag)) {
      setRecipientTags(recipientTags.filter(t => t !== tag));
    } else {
      setRecipientTags([...recipientTags, tag]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];
    
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`File "${file.name}" is too large (max 5MB)`);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments(prev => [
          ...prev,
          {
            name: file.name,
            type: file.type,
            size: file.size,
            content: reader.result as string
          }
        ]);
        toast.success(`Attached "${file.name}"`);
      };
      reader.readAsDataURL(file);
    });
    
    // Clear input
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    toast.success("Attachment removed");
  };

  const handleEmbedImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) {
        toast.error("Embed image is too large (max 3MB for single inline image)");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const imgTag = `<img src="${reader.result}" alt="${file.name}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0; display: block;" />`;
        setBody(prev => prev ? prev + '\n' + imgTag : imgTag);
        toast.success("Embedded inline image into HTML body!");
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const activeFilteredSubscribers = subscribers.filter(s => {
    if (s.status !== 'active') return false;
    if (recipientTags.length === 0) return true; // All Active Subscribers
    return s.tags?.some(t => recipientTags.includes(t));
  });

  const handleCreateCampaign = async (isSend: boolean) => {
    if (!title || !subject || !body) {
      toast.error("Please fill in Campaign Title, Subject, and HTML Content.");
      return;
    }

    if (isSend && activeFilteredSubscribers.length === 0) {
      toast.error("There are no active subscribers in the selected filter.");
      return;
    }

    setLoading(true);
    try {
      // 1. Save campaign doc to Firestore
      const newCampaign: Omit<EmailCampaign, 'id'> = {
        title,
        subject,
        body,
        status: isSend ? (sendType === 'schedule' ? 'scheduled' : 'sending') : 'draft',
        type,
        recipientTags,
        scheduledAt: sendType === 'schedule' ? scheduledAt : '',
        sentCount: 0,
        failedCount: 0,
        createdBy: auth.currentUser?.email || 'System',
        createdAt: new Date().toISOString(),
        attachmentsJson: JSON.stringify(attachments)
      };

      const docRef = await addDoc(collection(db, 'emailCampaigns'), newCampaign);
      
      if (isSend) {
        if (sendType === 'schedule') {
          toast.success("Campaign scheduled successfully!");
          onNavigate('campaigns');
        } else {
          // Bulk send directly in background
          toast.success("Launching bulk campaign send!");
          onNavigate('campaigns');
          // Call client API async
          axios.post('/api/gmail/send-bulk', {
            campaignId: docRef.id,
            recipients: activeFilteredSubscribers.map(s => ({ email: s.email, name: s.name }))
          }).catch(err => {
            console.error("Direct send request failed", err);
          });
        }
      } else {
        toast.success("Campaign draft saved!");
        onNavigate('campaigns');
      }
    } catch (e: any) {
      console.error("Error creating campaign", e);
      toast.error(`Failed to compose campaign: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Compose Campaign</h1>
          <p className="text-sm text-slate-500">Design beautiful emails, apply templates, select active target tags, and schedule or send.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer Form Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            
            {/* Title & Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Campaign Title (Internal)</label>
                <input
                  type="text"
                  placeholder="e.g. May 2026 Monthly Promotion"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="Newsletter">Newsletter</option>
                  <option value="Promotion">Promotion</option>
                  <option value="Update">Update</option>
                  <option value="Announcement">Announcement</option>
                  <option value="Follow-up">Follow-up</option>
                </select>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Subject Line</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Special Offer inside, {{name}}! 🎁"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Pro-tip: You can use <code className="font-mono bg-slate-50 dark:bg-slate-800 px-1 py-0.5 rounded text-amber-500">{"{{name}}"}</code> and <code className="font-mono bg-slate-50 dark:bg-slate-800 px-1 py-0.5 rounded text-amber-500">{"{{email}}"}</code> to insert personalized values!
              </p>
            </div>

            {/* Templates shortcut */}
            {templates.length > 0 && (
              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-800/10 rounded-lg">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Quick Template Apply
                </p>
                <div className="flex flex-wrap gap-2">
                  {templates.map(temp => (
                    <button
                      key={temp.id}
                      onClick={() => handleApplyTemplate(temp)}
                      className="text-[11px] bg-white border border-slate-200 px-2 py-1 rounded text-slate-700 hover:border-amber-500 hover:text-amber-600 transition-all font-medium"
                    >
                      {temp.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Campaign Body Editor with toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">HTML Content / Message Body</label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleEmbedImage}
                    className="flex items-center gap-1 text-xs text-amber-500 hover:underline font-semibold"
                  >
                    <Image className="w-3.5 h-3.5" /> Embed Inline Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(!previewMode)}
                    className="flex items-center gap-1.5 text-xs text-amber-500 hover:underline font-semibold"
                  >
                    {previewMode ? (
                      <>
                        <Code className="w-3.5 h-3.5" /> HTML Code Editor
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" /> Visual Live Preview
                      </>
                    )}
                  </button>
                </div>
              </div>

              {previewMode ? (
                <div className="border border-slate-250 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-950 min-h-[350px] overflow-auto max-h-[500px] prose dark:prose-invert max-w-none">
                  {body ? (
                    <div dangerouslySetInnerHTML={{ __html: body }} />
                  ) : (
                    <p className="text-slate-400 text-center py-20">Preview is empty. Write HTML on code view to see layout preview.</p>
                  )}
                </div>
              ) : (
                <textarea
                  rows={15}
                  placeholder="&lt;h1&gt;Hi {{name}},&lt;/h1&gt;&#13;&lt;p&gt;Check out our monthly updates...&lt;/p&gt;"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 min-h-[350px]"
                />
              )}
            </div>

            {/* Campaign-level File Attachments widget */}
            <div className="border-t border-slate-100 dark:border-slate-800/60 pt-5 mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email File Attachments</h4>
                  <p className="text-[10px] text-slate-400">Attach PDFs, images, or files to send alongside your campaign. Max 5MB per file.</p>
                </div>
                <label className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-all font-semibold text-slate-700 dark:text-slate-200">
                  <Paperclip className="w-3.5 h-3.5" /> Attach File(s)
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
                      <div className="flex items-center gap-2 overflow-hidden mr-2">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="overflow-hidden">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{att.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{(att.size / 1024).toFixed(1)} KB • {att.type.split('/')[1] || 'Unknown'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0"
                        title="Remove Attachment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-lg py-6 text-center text-xs text-slate-400 bg-slate-50/30 dark:bg-slate-950/10">
                  No files attached to this campaign. Use the button above to add documents or marketing flyers.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recipients Sidebar Filter & Publish options */}
        <div className="space-y-4">
          {/* Target List Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-950 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" /> Filter Target Recipients
            </h3>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-2">Select subscriber tags to target. Deselect all to send to <strong>All Active Subscribers</strong>.</p>
                {availableTags.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No subscriber tags defined yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map(tag => {
                      const selected = recipientTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleTagToggle(tag)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all font-medium ${
                            selected 
                              ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950 dark:border-amber-800'
                              : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-600 hover:border-slate-350 dark:text-slate-300'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-500">Active Target Group</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{activeFilteredSubscribers.length} Contacts</p>
                </div>
                <Info className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Delivery Options Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-950 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" /> Scheduling Options
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="sendType"
                    checked={sendType === 'now'}
                    onChange={() => setSendType('now')}
                    className="accent-amber-500"
                  />
                  Send Now
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="sendType"
                    checked={sendType === 'schedule'}
                    onChange={() => setSendType('schedule')}
                    className="accent-amber-500"
                  />
                  Schedule Later
                </label>
              </div>

              {sendType === 'schedule' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Target Date & Time</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex gap-2">
            <button
              onClick={() => handleCreateCampaign(false)}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1"
            >
              <Save className="w-4 h-4" /> Save Draft
            </button>
            <button
              onClick={() => handleCreateCampaign(true)}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow transition-all flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> {sendType === 'schedule' ? 'Schedule' : 'Send Campaign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
