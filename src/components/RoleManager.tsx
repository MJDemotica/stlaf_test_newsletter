import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  UserPlus, 
  Edit2,
  Shield, 
  User, 
  Users, 
  Loader2,
  Mail,
  Building2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  UserCheck,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp,
  where,
  updateDoc,
  limit
} from 'firebase/firestore';
import { UserRole, UserProfile } from '../types';

interface RoleAssignment {
  id: string;
  email: string;
  role: UserRole;
  department: string;
  assignedAt: any;
}

const DEPARTMENTS = ['HR', 'Litigation', 'Corpo', 'Accounting', 'IT', 'Operations'];

export const RoleManager = ({ addNotification, refreshKey }: { addNotification: any, refreshKey?: number }) => {
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLoading, setActiveLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'registered' | 'pending'>('active');
  
  // State for deletion confirmations
  const [isDeletingUserId, setIsDeletingUserId] = useState<string | null>(null);
  const [isDeletingAssignmentId, setIsDeletingAssignmentId] = useState<string | null>(null);
  const [isRejectingUserId, setIsRejectingUserId] = useState<string | null>(null);
  
  // State for editing active users
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ role: UserRole, department: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('marketing_member');
  const [department, setDepartment] = useState('Marketing');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Force switch to pending tab if there are new requests
    if (pendingUsers.length > 0 && activeTab === 'active') {
      // Don't auto-switch, but maybe highlight it?
    }
  }, [pendingUsers.length]);

  useEffect(() => {
    // 1. Fetch pre-registered assignments
    const q1 = query(collection(db, 'roleAssignments'), orderBy('email', 'asc'), limit(100));
    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RoleAssignment[];
      setAssignments(data);
      setLoading(false);
    });

    // 2. Fetch pending users
    const q2 = query(collection(db, 'users'), where('status', '==', 'pending'), limit(100));
    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as any as UserProfile[];
      setPendingUsers(data);
      setPendingLoading(false);
    });

    // 3. Fetch active users
    const q3 = query(collection(db, 'users'), where('status', '==', 'active'), limit(200));
    const unsubscribe3 = onSnapshot(q3, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as any as UserProfile[];
      setActiveUsers(data);
      setActiveLoading(false);
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    };
  }, [refreshKey]);

  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [approveValues, setApproveValues] = useState<{ role: UserRole, department: string } | null>(null);

  const handleApproveUser = async (uid: string, userEmail: string, assignedRole: UserRole, assignedDept: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        status: 'active',
        role: assignedRole,
        department: assignedDept
      });
      addNotification('User Approved', `${userEmail} has been granted access.`, 'success');
      setApprovingUserId(null);
      setApproveValues(null);
    } catch (err: any) {
      addNotification('Error', `Failed to approve user: ${err.message}`, 'warning');
    }
  };

  const handleRejectUser = async (uid: string, userEmail: string) => {
    try {
      // For rejection, we just delete the profile. The user won't be able to log in without a profile being pending again.
      await deleteDoc(doc(db, 'users', uid));
      addNotification('User Rejected', `${userEmail} request was denied.`, 'info');
      setIsRejectingUserId(null);
    } catch (err: any) {
      addNotification('Error', `Failed to reject user: ${err.message}`, 'warning');
    }
  };

  const handleDeleteUser = async (uid: string, userEmail: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
      
      // Also try to find and delete their role assignment if exists
      const assignment = assignments.find(a => a.email.toLowerCase() === userEmail.toLowerCase());
      if (assignment) {
        await deleteDoc(doc(db, 'roleAssignments', assignment.id));
      }
      
      addNotification('User Deleted', `Account profile for ${userEmail} was removed.`, 'info');
      setIsDeletingUserId(null);
    } catch (err: any) {
      addNotification('Error', `Failed to delete user profile: ${err.message}`, 'warning');
    }
  };

  const handleUpdateUser = async (uid: string) => {
    if (!editValues) return;
    setIsUpdating(true);
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        role: editValues.role,
        department: editValues.department
      });
      
      setEditingUserId(null);
      setEditValues(null);
      addNotification('Success', 'User profile updated successfully', 'success');
    } catch (error: any) {
      console.error('Error updating user:', error);
      addNotification('Error', 'Failed to update user: ' + error.message, 'warning');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'roleAssignments'), {
        email: email.toLowerCase().trim(),
        role,
        department,
        assignedAt: serverTimestamp()
      });
      
      addNotification('User Registered', `${email} has been assigned the ${role} role.`, 'success');
      setEmail('');
      setIsAdding(false);
      setActiveTab('registered');
    } catch (err: any) {
      addNotification('Error', `Failed to register user: ${err.message}`, 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, userEmail: string) => {
    try {
      await deleteDoc(doc(db, 'roleAssignments', id));
      addNotification('Assignment Removed', `Role assignment for ${userEmail} deleted.`, 'info');
      setIsDeletingAssignmentId(null);
    } catch (err: any) {
      addNotification('Error', `Failed to remove assignment: ${err.message}`, 'warning');
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'marketing_supervisor': return <Shield className="w-4 h-4 text-amber-500" />;
      case 'marketing_member': return <Users className="w-4 h-4 text-blue-500" />;
      default: return <User className="w-4 h-4 text-slate-500" />;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-amber-200 dark:hover:border-amber-900 transition-all">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Users</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{activeUsers.length}</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl group-hover:scale-110 transition-transform">
            <UserCheck className="w-6 h-6 text-emerald-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-amber-200 dark:hover:border-amber-900 transition-all cursor-pointer" onClick={() => setActiveTab('pending')}>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Access Requests</p>
            <p className={`text-3xl font-black ${pendingUsers.length > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>{pendingUsers.length}</p>
          </div>
          <div className={`p-3 rounded-2xl group-hover:scale-110 transition-transform ${pendingUsers.length > 0 ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
            <AlertCircle className={`w-6 h-6 ${pendingUsers.length > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-amber-200 dark:hover:border-amber-900 transition-all">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pre-registered</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{assignments.length}</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl group-hover:scale-110 transition-transform">
            <Shield className="w-6 h-6 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl w-fit backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50">
        <button 
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-600/50' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/30'}`}
        >
          <Users className="w-4 h-4" />
          Directory
        </button>
        <button 
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm border border-slate-200/50 dark:border-slate-600/50' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/30'}`}
        >
          <AlertCircle className={`w-4 h-4 ${pendingUsers.length > 0 ? 'text-rose-500 animate-pulse' : ''}`} />
          Pending
        </button>
        <button 
          onClick={() => setActiveTab('registered')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'registered' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-600/50' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/30'}`}
        >
          <Plus className="w-4 h-4" />
          Whitelist
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'active' && (
              <motion.div
                key="active-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Active Access</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Users currently active in the portal.</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</th>
                        <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</th>
                        <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Department</th>
                        <th className="text-right py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeLoading ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" /></td>
                        </tr>
                      ) : activeUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-20 text-center text-slate-400 dark:border-slate-800">No active users yet.</td>
                        </tr>
                      ) : (
                        activeUsers.map(user => (
                          <tr key={user.uid} className={`border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group ${editingUserId === user.uid ? 'bg-amber-50/50 dark:bg-amber-900/20' : ''}`}>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                {user.photoURL ? (
                                  <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full shadow-sm" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center"><User className="w-4 h-4 text-slate-400" /></div>
                                )}
                                <div>
                                  <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">{user.displayName}</p>
                                  <p className="text-[10px] text-slate-400 font-bold">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              {editingUserId === user.uid ? (
                                <select 
                                  value={editValues?.role}
                                  onChange={(e) => {
                                    const newRole = e.target.value as UserRole;
                                    setEditValues(prev => prev ? { 
                                      ...prev, 
                                      role: newRole,
                                      department: newRole === 'department' ? DEPARTMENTS[0] : 'Marketing'
                                    } : null);
                                  }}
                                  className="w-full text-xs font-bold p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                  <option value="marketing_member" className="dark:bg-slate-900">Marketing Member</option>
                                  <option value="marketing_supervisor" className="dark:bg-slate-900">Marketing Supervisor</option>
                                  <option value="department" className="dark:bg-slate-900">Department</option>
                                </select>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {getRoleIcon(user.role)}
                                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{getRoleLabel(user.role)}</span>
                                </div>
                              )}
                            </td>
                             <td className="py-4 px-4">
                               {editingUserId === user.uid ? (
                                 <select 
                                   disabled={editValues?.role !== 'department'}
                                   value={editValues?.role === 'department' ? editValues?.department : 'Marketing'}
                                   onChange={(e) => setEditValues(prev => prev ? { ...prev, department: e.target.value as any } : null)}
                                   className="w-full text-xs font-bold p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-400"
                                 >
                                   {editValues?.role !== 'department' ? (
                                     <option value="Marketing" className="dark:bg-slate-900">Marketing</option>
                                   ) : (
                                     DEPARTMENTS.map(dept => (
                                       <option key={dept} value={dept} className="dark:bg-slate-900">{dept}</option>
                                     ))
                                   )}
                                 </select>
                               ) : (
                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter italic">
                                  {user.department}
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {editingUserId === user.uid ? (
                                  <>
                                    <button 
                                      onClick={() => handleUpdateUser(user.uid)}
                                      disabled={isUpdating}
                                      className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all"
                                      title="Save Changes"
                                    >
                                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    </button>
                                    <button 
                                      onClick={() => { setEditingUserId(null); setEditValues(null); }}
                                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                                      title="Cancel Edit"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button 
                                      onClick={() => {
                                        setEditingUserId(user.uid);
                                        setEditValues({ role: user.role, department: user.department });
                                      }}
                                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                                      title="Edit User"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    {isDeletingUserId === user.uid ? (
                                      <div className="flex items-center gap-1 p-1 bg-rose-50 dark:bg-rose-900/10 rounded-xl">
                                        <button 
                                          onClick={() => handleDeleteUser(user.uid, user.email)}
                                          className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-sm"
                                        >
                                          Confirm
                                        </button>
                                        <button 
                                          onClick={() => setIsDeletingUserId(null)}
                                          className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button 
                                        onClick={() => setIsDeletingUserId(user.uid)}
                                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                                        title="Delete User"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'pending' && (
              <motion.div
                key="pending-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Access Requests</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">New sign-ins awaiting your verification.</p>
                </div>

                {pendingUsers.length === 0 ? (
                  <div className="py-20 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex flex-col items-center gap-3">
                    <UserCheck className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                    <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">All caught up! No requests pending.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pendingUsers.map(user => (
                      <div key={user.uid} className="p-5 bg-white dark:bg-slate-800 border-2 border-amber-100 dark:border-amber-900/30 rounded-2xl shadow-sm space-y-4 hover:border-amber-200 dark:hover:border-amber-800 transition-all">
                        <div className="flex items-center gap-3">
                          {user.photoURL ? (
                            <img src={user.photoURL} className="w-12 h-12 rounded-xl shadow-sm" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center"><User className="w-6 h-6 text-slate-400" /></div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 dark:text-white truncate">{user.displayName}</p>
                            <p className="text-[10px] font-medium text-slate-400 truncate">{user.email}</p>
                          </div>
                        </div>
                        {approvingUserId === user.uid ? (
                          <div className="space-y-3">
                            <select
                              value={approveValues?.role || 'department'}
                              onChange={(e) => {
                                const newRole = e.target.value as UserRole;
                                setApproveValues(prev => ({
                                  ...prev,
                                  role: newRole,
                                  department: newRole === 'department' ? DEPARTMENTS[0] : 'Marketing'
                                }));
                              }}
                              className="w-full text-xs font-bold p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="marketing_member">Marketing Member</option>
                              <option value="marketing_supervisor">Marketing Supervisor</option>
                              <option value="department">Department</option>
                            </select>
                            <select
                              disabled={approveValues?.role !== 'department'}
                              value={approveValues?.role === 'department' ? (approveValues?.department || DEPARTMENTS[0]) : 'Marketing'}
                              onChange={(e) => setApproveValues(prev => prev ? { ...prev, department: e.target.value as any } : { role: 'department', department: e.target.value as any })}
                              className="w-full text-xs font-bold p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:dark:bg-slate-800 disabled:text-slate-400"
                            >
                              {approveValues?.role !== 'department' ? (
                                <option value="Marketing">Marketing</option>
                              ) : (
                                DEPARTMENTS.map(dept => (
                                  <option key={dept} value={dept}>{dept}</option>
                                ))
                              )}
                            </select>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleApproveUser(user.uid, user.email, approveValues?.role || 'department', approveValues?.department || DEPARTMENTS[0])}
                                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg transition-all"
                              >
                                Confirm Approve
                              </button>
                              <button 
                                onClick={() => {
                                  setApprovingUserId(null);
                                  setApproveValues(null);
                                }}
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-lg transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setApprovingUserId(user.uid);
                                setApproveValues({ role: 'department', department: DEPARTMENTS[0] });
                              }}
                              className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg transition-all"
                            >
                              Approve
                            </button>
                            {isRejectingUserId === user.uid ? (
                              <div className="flex-1 flex items-center gap-1">
                                <button 
                                  onClick={() => handleRejectUser(user.uid, user.email)}
                                  className="flex-1 py-2 bg-rose-600 text-white text-[10px] font-bold rounded-lg transition-all"
                                >
                                  Confirm
                                </button>
                                <button 
                                  onClick={() => setIsRejectingUserId(null)}
                                  className="px-2 py-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-lg transition-all"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setIsRejectingUserId(user.uid)}
                                className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-lg transition-all"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'registered' && (
              <motion.div
                key="registered-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pre-registered Roles</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Set permissions before a user even signs in.</p>
                  </div>
                  <button 
                    onClick={() => setIsAdding(!isAdding)}
                    className="px-4 py-2 bg-amber-500 text-primary-dark rounded-xl text-xs font-bold hover:bg-amber-600 transition-all shadow-sm flex items-center gap-2"
                  >
                    {isAdding ? <XCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {isAdding ? 'Cancel' : 'Register Email'}
                  </button>
                </div>

                <AnimatePresence>
                  {isAdding && (
                    <motion.form 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onSubmit={handleAdd} 
                      className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-4 items-end shadow-inner"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 pl-1">Gmail</label>
                        <input 
                          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 pl-1">Role</label>
                        <select 
                          value={role} 
                          onChange={(e) => {
                            const newRole = e.target.value as UserRole;
                            setRole(newRole);
                            if (newRole === 'department') {
                              setDepartment(DEPARTMENTS[0]);
                            } else {
                              setDepartment('Marketing');
                            }
                          }}
                          className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                        >
                          <option value="marketing_member" className="dark:bg-slate-900">Member</option>
                          <option value="marketing_supervisor" className="dark:bg-slate-900">Supervisor</option>
                          <option value="department" className="dark:bg-slate-900">Department</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 pl-1">Department</label>
                        <select 
                          disabled={role !== 'department'}
                          value={role === 'department' ? department : 'Marketing'} 
                          onChange={(e) => setDepartment(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400"
                        >
                          {role !== 'department' ? (
                            <option value="Marketing" className="dark:bg-slate-900">Marketing</option>
                          ) : (
                            DEPARTMENTS.map(dept => (
                              <option key={dept} value={dept} className="dark:bg-slate-900">{dept}</option>
                            ))
                          )}
                        </select>
                      </div>
                      <button 
                        disabled={isSubmitting}
                        className="py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-xs font-bold hover:bg-black dark:hover:bg-slate-600 transition-all disabled:opacity-50"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Register'}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                        <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</th>
                        <th className="text-right py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={3} className="py-12 text-center"><Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" /></td></tr>
                      ) : assignments.length === 0 ? (
                        <tr><td colSpan={3} className="py-20 text-center text-slate-400 dark:text-slate-500 italic">No pre-registrations yet.</td></tr>
                      ) : (
                        assignments.map(item => (
                          <tr key={item.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                            <td className="py-4 px-4"><p className="text-sm font-bold text-slate-900 dark:text-white">{item.email}</p></td>
                            <td className="py-4 px-4"><span className="text-xs font-medium text-slate-500 dark:text-slate-400">{getRoleLabel(item.role)} ({item.department})</span></td>
                            <td className="py-4 px-4 text-right">
                              {isDeletingAssignmentId === item.id ? (
                                <div className="flex items-center justify-end gap-1 p-1 bg-rose-50 dark:bg-rose-900/10 rounded-xl w-fit ml-auto">
                                  <button 
                                    onClick={() => handleDelete(item.id, item.email)}
                                    className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-sm"
                                  >
                                    Confirm
                                  </button>
                                  <button 
                                    onClick={() => setIsDeletingAssignmentId(null)}
                                    className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setIsDeletingAssignmentId(item.id)} 
                                  className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
          
      <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl flex gap-3">
        <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-blue-800 dark:text-blue-300 leading-relaxed">
          <strong>Tip:</strong> Users with pre-registered emails will automatically skip the "Pending" status and receive their assigned role on their first login. Use this to onboard your team faster.
        </p>
      </div>
    </div>
  );
};
