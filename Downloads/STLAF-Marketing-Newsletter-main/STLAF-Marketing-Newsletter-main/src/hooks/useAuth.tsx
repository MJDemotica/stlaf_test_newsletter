//
// File: useAuth.tsx
// Purpose: Authentication context provider using Supabase Auth + profiles table
//

import React, { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUPERVISOR_EMAILS = ['cbalvarado@sadsadtamesislaw.com', 'markjosephdemotica@gmail.com'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrCreateProfile = async (authUser: User) => {
    // 1. Look for a pre-registered role assignment (like the old roleAssignments collection)
    const { data: assignment } = await supabase
      .from('role_assignments')
      .select('*')
      .eq('email', authUser.email?.toLowerCase())
      .maybeSingle();

    // 2. Look for an existing profile row
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (existingProfile) {
      const updates: Partial<UserProfile> = {};
      if (assignment && existingProfile.role !== assignment.role) updates.role = assignment.role;
      if (assignment && existingProfile.department !== assignment.department) updates.department = assignment.department;
      if (authUser.user_metadata?.avatar_url && existingProfile.photo_url !== authUser.user_metadata.avatar_url) {
        updates.photo_url = authUser.user_metadata.avatar_url;
      }
      if (Object.keys(updates).length > 0) {
        const { data: updated } = await supabase
          .from('profiles').update(updates).eq('id', authUser.id).select().maybeSingle();
        setProfile(mapProfile(updated || { ...existingProfile, ...updates }));
      } else {
        setProfile(mapProfile(existingProfile));
      }
      return;
    }

    // 3. First-ever login: create a new profile row
    const isSupervisor = SUPERVISOR_EMAILS.includes(authUser.email || '');
    const role: UserRole = assignment?.role || (isSupervisor ? 'marketing_supervisor' : 'department');
    const department = assignment?.department || 'Operations';
    const status = (assignment || isSupervisor) ? 'active' : 'pending';

    const { data: created } = await supabase.from('profiles').insert({
      id: authUser.id,
      email: authUser.email,
      display_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
      role,
      department,
      photo_url: authUser.user_metadata?.avatar_url,
      status
    }).select().maybeSingle();

    setProfile(mapProfile(created));
  };

  const mapProfile = (row: any): UserProfile | null => {
    if (!row) return null;
    return {
      uid: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      department: row.department,
      photoURL: row.photo_url,
      status: row.status
    };
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) loadOrCreateProfile(session.user);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadOrCreateProfile(session.user);
      } else {
        setProfile(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const dbUpdates: any = {};
    if (data.displayName !== undefined) dbUpdates.display_name = data.displayName;
    if (data.photoURL !== undefined) dbUpdates.photo_url = data.photoURL;
    if (data.role !== undefined) dbUpdates.role = data.role;
    if (data.department !== undefined) dbUpdates.department = data.department;

    const { data: updated } = await supabase
      .from('profiles').update(dbUpdates).eq('id', user.id).select().maybeSingle();
    setProfile(mapProfile(updated));
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}