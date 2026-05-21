import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Download, 
  Upload, 
  Search, 
  Filter, 
  Trash2, 
  Edit2, 
  UserCheck, 
  UserMinus, 
  X, 
  FileText, 
  Tag, 
  RefreshCw 
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Subscriber } from '../types';
import { toast } from 'react-hot-toast';
import Papa from 'papaparse';

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

export const SubscribersView: React.FC = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unsubscribed' | 'bounced'>('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [uniqueTags, setUniqueTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscriber | null>(null);
  const [subName, setSubName] = useState('');
  const [subEmail, setSubEmail] = useState('');
  const [subStatus, setSubStatus] = useState<'active' | 'unsubscribed' | 'bounced'>('active');
  const [subTagsText, setSubTagsText] = useState('');

  // Bulk Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'subscribers'), (snapshot) => {
      const list: Subscriber[] = [];
      const tags = new Set<string>();
      snapshot.forEach(doc => {
        const data = doc.data() as Subscriber;
        const parsedTags = parseTags(data.tags);
        list.push({ ...data, tags: parsedTags, id: doc.id });
        parsedTags.forEach(t => tags.add(t));
      });
      list.sort((a,b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
      setSubscribers(list);
      setUniqueTags(Array.from(tags));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openAddModal = () => {
    setEditingSub(null);
    setSubName('');
    setSubEmail('');
    setSubStatus('active');
    setSubTagsText('');
    setShowAddModal(true);
  };

  const openEditModal = (sub: Subscriber) => {
    setEditingSub(sub);
    setSubName(sub.name);
    setSubEmail(sub.email);
    setSubStatus(sub.status);
    setSubTagsText(sub.tags?.join(', ') || '');
    setShowAddModal(true);
  };

  const handleSaveSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subEmail || !subName) {
      toast.error("Email and Name are required");
      return;
    }

    const tags = subTagsText.split(',').map(t => t.trim()).filter(Boolean);

    try {
      if (editingSub) {
        // Edit
        await setDoc(doc(db, 'subscribers', editingSub.id), {
          name: subName,
          email: subEmail,
          status: subStatus,
          tags,
          addedAt: editingSub.addedAt,
          addedBy: editingSub.addedBy
        }, { merge: true });
        toast.success("Subscriber updated successfully!");
      } else {
        // New
        await addDoc(collection(db, 'subscribers'), {
          name: subName,
          email: subEmail,
          status: subStatus,
          tags,
          addedAt: new Date().toISOString(),
          addedBy: auth.currentUser?.email || 'admin'
        });
        toast.success("Subscriber added!");
      }
      setShowAddModal(false);
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    }
  };

  const toggleStatus = async (sub: Subscriber) => {
    const newStatus = sub.status === 'active' ? 'unsubscribed' : 'active';
    try {
      await setDoc(doc(db, 'subscribers', sub.id), { status: newStatus }, { merge: true });
      toast.success(`Subscriber is now ${newStatus}`);
    } catch (err: any) {
      toast.error("Toggle status failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this subscriber?")) return;
    try {
      await deleteDoc(doc(db, 'subscribers', id));
      toast.success("Deleted subscriber");
    } catch (e: any) {
      toast.error("Delete failed");
    }
  };

  const handleExportCSV = () => {
    const csvContent = Papa.unparse(subscribers.map(s => ({
      Name: s.name,
      Email: s.email,
      Tags: s.tags?.join(';'),
      Status: s.status,
      AddedAt: s.addedAt
    })));

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `subscribers_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Export completed!");
  };

  const handleCsvUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      toast.error("Please pick a valid CSV file");
      return;
    }

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const batch = writeBatch(db);
        let count = 0;
        
        results.data.forEach((row: any) => {
          // Detect headers: name, email, tags, status
          const email = row.Email || row.email || row.EMAIL;
          const name = row.Name || row.name || row.NAME || email?.split('@')[0];
          const tagsStr = row.Tags || row.tags || row.TAGS || '';
          const status = (row.Status || row.status || 'active').toLowerCase() as any;

          if (email) {
            const tags = tagsStr.split(';').map((t: string) => t.trim()).filter(Boolean);
            const newDocRef = doc(collection(db, 'subscribers'));
            batch.set(newDocRef, {
              email,
              name,
              tagsSpace: tagsStr, // preserving raw
              tags,
              status: ['active', 'unsubscribed', 'bounced'].includes(status) ? status : 'active',
              addedAt: new Date().toISOString(),
              addedBy: auth.currentUser?.email || 'bulk-uploader'
            });
            count++;
          }
        });

        if (count > 0) {
          try {
            await batch.commit();
            toast.success(`Broadly imported ${count} subscribers!`);
            setShowImportModal(false);
            setCsvFile(null);
          } catch (err: any) {
            toast.error(`Write failed: ${err.message}`);
          }
        } else {
          toast.error("No valid subscribers found in CSV.");
        }
      }
    });
  };

  const filtered = subscribers.filter(sub => {
    const matchesSearch = sub.name?.toLowerCase().includes(search.toLowerCase()) || 
                          sub.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    const matchesTag = tagFilter === 'all' || sub.tags?.includes(tagFilter);

    return matchesSearch && matchesStatus && matchesTag;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Email Subscribers</h1>
          <p className="text-sm text-slate-500">Manage your newsletter audiences, active targets, custom tags, and bulk CSV uploads.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 font-semibold text-white rounded-lg text-xs"
          >
            <Plus className="w-4 h-4" /> Add Subscriber
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-250 text-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold"
          >
            <Upload className="w-4 h-4" /> CSV Import
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-250 text-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Audiences Filters Box */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            placeholder="Search by name or email address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="bounced">Bounced</option>
          </select>

          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none min-w-[120px]"
          >
            <option value="all">All Segment Tags</option>
            {uniqueTags.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Subscribers Table card design */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Segment Tags</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created Date</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading audience lists...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">No subscribers match search filters.</td>
                </tr>
              ) : (
                filtered.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{sub.name}</td>
                    <td className="px-6 py-4 font-mono text-xs">{sub.email}</td>
                    <td className="px-6 py-4 max-w-xs truncate">
                      <div className="flex flex-wrap gap-1">
                        {sub.tags && sub.tags.map(t => (
                          <span key={t} className="bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-amber-200/45">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        sub.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30' :
                        sub.status === 'unsubscribed' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {sub.addedAt ? new Date(sub.addedAt).toLocaleDateString() : ''}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => toggleStatus(sub)}
                          className={`p-1 rounded text-xs px-2 font-bold transition-all ${
                            sub.status === 'active' 
                              ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' 
                              : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {sub.status === 'active' ? 'Unsubscribe' : 'Activate'}
                        </button>
                        <button
                          onClick={() => openEditModal(sub)}
                          className="p-1 text-slate-500 hover:text-slate-800"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sub.id)}
                          className="p-1 text-red-500 hover:text-red-700"
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

      {/* Add / Edit Subscriber Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveSubscriber} className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">
                {editingSub ? "Edit Subscriber Profile" : "Register New Subscriber"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="john.doe@example.com"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Segment Tags (Comma Separated)</label>
                <input
                  type="text"
                  placeholder="VIP, May2026, Tech, Lead"
                  value={subTagsText}
                  onChange={(e) => setSubTagsText(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-950 dark:text-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">Tags are used to filter campaigns and customize sends.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</label>
                <select
                  value={subStatus}
                  onChange={(e) => setSubStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="unsubscribed">Unsubscribed</option>
                  <option value="bounced">Bounced</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold"
              >
                Save Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCsvUpload} className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-amber-500" /> Bulk subscribers CSV Import
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Your CSV should include columns like <strong>Email</strong>, <strong>Name</strong>, and optionally <strong>Tags</strong> (use semicolon separator if multiple) and <strong>Status</strong>.
              </p>

              <div className="border-2 border-dashed border-slate-250 dark:border-slate-800 rounded-xl p-8 text-center bg-slate-50 dark:bg-slate-950">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                  id="csv-file-selector"
                />
                <label htmlFor="csv-file-selector" className="cursor-pointer space-y-2 block">
                  <Upload className="w-8 h-8 mx-auto text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {csvFile ? csvFile.name : "Select subscription list CSV"}
                  </p>
                  <p className="text-xs text-slate-400">Click to browse or drop file here</p>
                </label>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold"
              >
                Parse & Upload
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
