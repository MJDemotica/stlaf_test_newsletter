import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Shield, 
  Building2, 
  Calendar, 
  LogOut,
  Camera,
  CheckCircle2,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile } from '../types';

interface ProfileViewProps {
  profile: UserProfile | null;
  onLogout: () => void;
  onUpdateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

export const ProfileView = ({ profile, onLogout, onUpdateProfile }: ProfileViewProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(profile?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!profile) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        try {
          await onUpdateProfile({ photoURL: dataUrl });
        } catch (error) {
          console.error("Failed to update profile photo:", error);
        } finally {
          setIsUploadingPhoto(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveName = async () => {
    if (!newName.trim() || newName === profile.displayName) {
      setIsEditingName(false);
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateProfile({ displayName: newName });
      setIsEditingName(false);
    } catch (error) {
      console.error('Failed to update profile name:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Profile Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-colors duration-300">
        <div className="h-32 bg-gradient-to-r from-amber-400 to-amber-600 relative">
          <div className="absolute -bottom-12 left-8 p-1 bg-white dark:bg-slate-900 rounded-full border-4 border-white dark:border-slate-900 shadow-xl">
            {profile.photoURL ? (
              <img 
                src={profile.photoURL} 
                alt={profile.displayName} 
                className="w-24 h-24 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <User className="w-12 h-12 text-slate-300 dark:text-slate-700" />
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handlePhotoUpload} 
            />
            <button 
              className="absolute bottom-0 right-0 p-2 bg-amber-500 text-white rounded-full shadow-lg hover:bg-amber-600 transition-all border-2 border-white dark:border-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
            >
              {isUploadingPhoto ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        <div className="pt-16 pb-8 px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1 min-h-[40px]">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="text-2xl font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border border-amber-300 dark:border-amber-900/50 rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-amber-500/20"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') setIsEditingName(false);
                      }}
                    />
                    <button 
                      onClick={handleSaveName}
                      disabled={isSaving}
                      className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? <span className="animate-spin text-sm">...</span> : <Check className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => {
                        setIsEditingName(false);
                        setNewName(profile.displayName);
                      }}
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{profile.displayName}</h1>
                    <CheckCircle2 className="w-5 h-5 text-amber-500" />
                    <button 
                      onClick={() => {
                        setNewName(profile.displayName);
                        setIsEditingName(true);
                      }}
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">{profile.role.replace('_', ' ').toUpperCase()}</p>
            </div>
            <button 
              onClick={onLogout}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white rounded-xl font-bold transition-all border border-rose-100 dark:border-rose-900/30"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
        >
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <User className="w-5 h-5 text-amber-500" />
            Personal Information
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl">
              <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
                <Mail className="w-5 h-5 text-slate-400 dark:text-slate-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Email Address</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{profile.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl">
              <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
                <Building2 className="w-5 h-5 text-slate-400 dark:text-slate-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Department</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{profile.department}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
        >
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            Permissions & Status
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl">
              <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
                <Shield className="w-5 h-5 text-slate-400 dark:text-slate-600" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Access Role</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize text-amber-600 dark:text-amber-500">
                  {profile.role.replace('_', ' ')}
                </p>
              </div>
              <div className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {profile.status}
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl">
              <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
                <Calendar className="w-5 h-5 text-slate-400 dark:text-slate-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Account Access</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Complete Marketing Suite</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

    </div>
  );
};
