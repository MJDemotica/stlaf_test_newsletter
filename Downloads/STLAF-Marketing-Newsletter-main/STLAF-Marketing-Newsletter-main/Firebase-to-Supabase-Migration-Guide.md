# Firebase → Supabase Migration Guide
### STLAF Marketing Newsletter Portal
**Audience:** Junior developer, knows basic Python, is learning JS/TS, React, and backend concepts for the first time.
**Goal:** Replace every Firebase service (Firestore, Firebase Auth, Firebase Storage) with Supabase (Postgres, Supabase Auth, Supabase Storage), with **no leftover Firebase code** anywhere in the repo.

---

## 0. How to read this document

Each task below has four parts:

- **Why** — the reasoning, in plain language.
- **Do this** — the exact action (click a button, run a command, paste code).
- **Code** — the snippet to add/replace, with the exact file path.
- **Verify** — how to confirm it worked before moving to the next task.

Work through the phases **in order**. Do not skip ahead — later phases depend on earlier ones. Commit your work to git after each phase so you can roll back if something breaks.

> 🐍 **Python analogy used throughout this doc:** Firestore is like a big Python dictionary of dictionaries you can query loosely. Supabase/Postgres is like a set of `pandas` DataFrames (tables) with fixed columns, foreign keys, and SQL queries. Firebase Auth vs Supabase Auth is like switching from one login library to another — same idea (user signs in with Google, gets a token), different vendor.

---

## Phase 0 — Accounts, Tools, and API Keys

Nothing else can start until this phase is done.

### 0.1 Create a Supabase account and project

**Why:** Supabase is the new home for your database, authentication, and file storage. You need a "project" (like a Firebase "project") before you can get any keys.

**Do this:**
1. Go to https://supabase.com and click **Start your project** → sign up (GitHub login is easiest).
2. Click **New project**.
3. Fill in:
   - **Name:** `stlaf-marketing-newsletter`
   - **Database Password:** generate a strong one and **save it in a password manager** — you'll need it later for direct Postgres connections.
   - **Region:** pick the one closest to your users (e.g. Southeast Asia if your users are in the Philippines).
4. Click **Create new project** and wait 1–2 minutes for it to provision.

**Verify:** You land on a project dashboard with a left sidebar showing **Table Editor**, **Authentication**, **Storage**, **SQL Editor**, etc.

### 0.2 Get your API keys and URL

**Why:** Your frontend and backend both need a URL + key to talk to Supabase, exactly like `VITE_FIREBASE_API_KEY` did for Firebase.

**Do this:**
1. In the sidebar, go to **Project Settings → API** (or click **Connect** at the top of the dashboard).
2. You'll see:
   - **Project URL** — looks like `https://xxxxxxxx.supabase.co`
   - **Publishable key** (`sb_publishable_...`) — this is the new name for the old "anon" key. Safe to use in the browser.
   - **Secret key** (`sb_secret_...`) — this is the new name for the old "service_role" key. **Never** put this in frontend code — server-only.
   - If your project still shows the "Legacy API Keys" tab, you'll instead see `anon` and `service_role` keys — functionally the same thing, just older naming. Either pair works with the code in this guide.

**Verify:** You have copied 3 values somewhere safe (a scratch note, not committed to git yet):
```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxx   (or anon key)
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxx             (or service_role key)
```

### 0.3 Install the tools you'll need locally

**Do this**, in your project's root terminal:

```bash
# Supabase JS client — this replaces the "firebase" npm package
npm install @supabase/supabase-js

# Supabase CLI — lets you write/run SQL migrations from your terminal
npm install -D supabase
```

**Verify:** run `npx supabase --version` and confirm it prints a version number.

### 0.4 Set up Google Sign-In for Supabase Auth

**Why:** The app currently uses **Firebase Auth + Google Sign-In**. Supabase Auth can also do Google Sign-In, but it needs its own Google OAuth "Client ID/Secret" wired into Supabase (you cannot reuse the Firebase one directly, though you can reuse the same Google Cloud project).

**Do this:**
1. Go to https://console.cloud.google.com/ → select the same Google Cloud project you used for Firebase (or create a new OAuth Client if you prefer a clean separation).
2. Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**.
3. Application type: **Web application**.
4. Under **Authorized redirect URIs**, add the callback URL Supabase gives you. To find it:
   - In Supabase dashboard: **Authentication → Providers → Google**.
   - Copy the **Callback URL (for OAuth)** shown there — it looks like `https://xxxxxxxx.supabase.co/auth/v1/callback`.
   - Paste that into the Google Cloud "Authorized redirect URIs" field, then **Save**.
5. Copy the **Client ID** and **Client Secret** Google gives you.
6. Back in Supabase: **Authentication → Providers → Google** → toggle **Enable** → paste in Client ID and Client Secret → **Save**.
7. In **Authentication → URL Configuration**, set:
   - **Site URL:** your production domain (e.g. `https://your-domain.com`)
   - **Redirect URLs:** add `http://localhost:3000/**` for local dev and your production domain with `/**`.

**Verify:** The Google provider toggle in Supabase shows "Enabled" with a green dot.

### 0.5 Decide your deployment host

**Why:** Firebase Storage/Firestore don't care where your Node server runs, but Supabase's server-side calls need environment variables set on whatever host you deploy to (Vercel, in this app's case — see `vercel.json`).

**Do this:** In your Vercel project dashboard → **Settings → Environment Variables**, you will add (in Phase 6) the new `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_...`, and `SUPABASE_SECRET_KEY` variables, and **delete** all `VITE_FIREBASE_*`, `GMAIL_*` stays as-is (Gmail sending logic is unrelated to this migration).

---

## Phase 1 — Design the Database Schema (Firestore → Postgres tables)

**Why:** Firestore stores documents (loose JSON) inside "collections." Postgres (what Supabase runs) stores rows inside tables with fixed columns and types. You must design tables that match each Firestore collection used in the app.

### 1.1 Collection → Table mapping

| Firestore collection | New Postgres table | Used in |
|---|---|---|
| `subscribers` | `subscribers` | SubscribersView, api/public-subscribe.js, api/public-verify.js, api/public-unsubscribe.js |
| `emailCampaigns` | `email_campaigns` | ComposeCampaignView, CampaignsListView, api/gmail.js, api/cron.js |
| `emailTemplates` | `email_templates` | TemplatesView |
| `emailLogs` | `email_logs` | SentHistoryView, api/gmail.js |
| `notifications` | `notifications` | NotificationDropdown, notificationService.ts |
| `users` | `profiles` (Supabase already has an internal `auth.users` table — we add a `profiles` table linked to it) | useAuth.tsx, RoleManager |
| `roleAssignments` | `role_assignments` | RoleManager, useAuth.tsx |
| `concerns` | `concerns` | HelpView, AdminView |
| `settings/quick_links` (a single doc) | `settings` (one row per key, JSON value column) | SettingsView, App.tsx |
| `settings/gmail_config` (a single doc) | `gmail_config` (dedicated table, one row) | api/gmail.js, api/cron.js, server.ts |
| `uploadedImages/{id}` | *(removed — replaced by real Supabase Storage, see Phase 3)* | api/hosted-images.js, api/upload.js |

> 🐍 Python analogy: this is like turning 10 loosely-shaped dictionaries into 10 `CREATE TABLE` statements — you're just being explicit about what fields exist and what type each one is.

### 1.2 Write the SQL schema

**Do this:** In the Supabase dashboard, go to **SQL Editor → New Query**, paste the following, and click **Run**. This creates every table in one shot.

```sql
-- ============================================================
-- 1. PROFILES (replaces Firestore "users" collection)
--    Linked 1-to-1 with Supabase's built-in auth.users table
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'department', -- 'marketing_supervisor' | 'marketing_member' | 'department'
  department text not null default 'Operations',
  photo_url text,
  status text not null default 'pending', -- 'active' | 'pending' | 'blocked'
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. ROLE ASSIGNMENTS (pre-registered emails + their future role)
-- ============================================================
create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null,
  department text not null,
  assigned_at timestamptz not null default now()
);

-- ============================================================
-- 3. SUBSCRIBERS
-- ============================================================
create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Anonymous',
  email text not null,
  status text not null default 'pending', -- active | pending | unsubscribed | bounced
  tags text[] not null default '{}',
  added_at timestamptz not null default now(),
  added_by text,
  unsubscribe_reason text,
  unsubscribed_at timestamptz,
  verified_at timestamptz,
  verification_token text,
  verification_expires_at timestamptz
);
create unique index subscribers_email_idx on public.subscribers (lower(email));

-- ============================================================
-- 4. EMAIL TEMPLATES
-- ============================================================
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body text not null,
  category text not null default 'Newsletter',
  created_by text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. EMAIL CAMPAIGNS
-- ============================================================
create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft', -- draft | scheduled | sending | sent | failed
  type text not null default 'Newsletter',
  recipient_tags text[] not null default '{}',
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  attachments_json text,
  imported_post_id text,
  opens_count int not null default 0,
  clicks_count int not null default 0,
  opened_emails text[] not null default '{}',
  clicked_emails text[] not null default '{}'
);

-- ============================================================
-- 6. EMAIL LOGS
-- ============================================================
create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.email_campaigns(id) on delete cascade,
  recipient_email text not null,
  status text not null, -- sent | failed
  error_message text,
  sent_at timestamptz not null default now(),
  gmail_message_id text
);

-- ============================================================
-- 7. NOTIFICATIONS
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  type text not null default 'info', -- info | success | warning | error
  user_id uuid references auth.users(id),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 8. CONCERNS (support tickets)
-- ============================================================
create table public.concerns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  user_email text,
  user_name text,
  subject text default 'No Subject',
  messages jsonb not null default '[]', -- array of {text, senderId, senderName, role, timestamp}
  status text not null default 'pending', -- pending | reviewed | resolved
  created_at timestamptz not null default now()
);

-- ============================================================
-- 9. GENERIC SETTINGS (quick_links, social_links, governance, etc.)
-- ============================================================
create table public.settings (
  key text primary key,
  value jsonb not null
);

-- ============================================================
-- 10. GMAIL CONFIG (single-row table for the OAuth token state)
-- ============================================================
create table public.gmail_config (
  id int primary key default 1,
  connected boolean not null default false,
  authorized_email text,
  access_token text,
  refresh_token text,
  token_expiry bigint,
  constraint single_row check (id = 1)
);
insert into public.gmail_config (id, connected) values (1, false);
```

**Verify:** Go to **Table Editor** in the Supabase dashboard — you should see all 10 tables listed on the left.

### 1.3 Recreate `firestore.rules` as Row Level Security (RLS) policies

**Why:** `firestore.rules` controlled who could read/write each collection. Postgres's equivalent is **Row Level Security (RLS)** — SQL rules attached directly to each table.

**Do this:** Run this in the SQL Editor:

```sql
-- Turn on RLS for every table (this means: "deny everything by default")
alter table public.profiles enable row level security;
alter table public.role_assignments enable row level security;
alter table public.subscribers enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.concerns enable row level security;
alter table public.settings enable row level security;
alter table public.gmail_config enable row level security;

-- Helper function: is the current logged-in user "active" and what role do they have?
create or replace function public.current_user_is_active()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role = 'marketing_supervisor'
  );
$$;

-- PROFILES: any signed-in user can read; a user can edit their own row; admins can edit anyone's
create policy "read profiles" on public.profiles for select
  using (auth.role() = 'authenticated');
create policy "update own profile" on public.profiles for update
  using (auth.uid() = id or public.current_user_is_admin());
create policy "insert own profile" on public.profiles for insert
  with check (auth.uid() = id);
create policy "admin delete profile" on public.profiles for delete
  using (public.current_user_is_admin());

-- ROLE ASSIGNMENTS: admins only
create policy "admin manage role_assignments" on public.role_assignments for all
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy "read role_assignments" on public.role_assignments for select
  using (auth.role() = 'authenticated');

-- SUBSCRIBERS, TEMPLATES, CAMPAIGNS, LOGS: any "active" staff member
create policy "active users manage subscribers" on public.subscribers for all
  using (public.current_user_is_active()) with check (public.current_user_is_active());
create policy "active users manage templates" on public.email_templates for all
  using (public.current_user_is_active()) with check (public.current_user_is_active());
create policy "active users manage campaigns" on public.email_campaigns for all
  using (public.current_user_is_active()) with check (public.current_user_is_active());
create policy "active users manage logs" on public.email_logs for all
  using (public.current_user_is_active()) with check (public.current_user_is_active());

-- NOTIFICATIONS: active users can read/write; a user only sees notifications with no owner or their own
create policy "active users see notifications" on public.notifications for select
  using (public.current_user_is_active() and (user_id is null or user_id = auth.uid()));
create policy "active users write notifications" on public.notifications for insert
  with check (public.current_user_is_active());
create policy "active users update notifications" on public.notifications for update
  using (public.current_user_is_active());

-- CONCERNS: a user can create/read their own; admins can read/update/delete all
create policy "create own concern" on public.concerns for insert
  with check (auth.uid() = user_id);
create policy "read own or admin" on public.concerns for select
  using (auth.uid() = user_id or public.current_user_is_admin());
create policy "admin update concern" on public.concerns for update
  using (public.current_user_is_admin());
create policy "admin delete concern" on public.concerns for delete
  using (public.current_user_is_admin());

-- SETTINGS: everyone active can read, only admins can write
create policy "active read settings" on public.settings for select
  using (public.current_user_is_active());
create policy "admin write settings" on public.settings for insert
  with check (public.current_user_is_admin());
create policy "admin update settings" on public.settings for update
  using (public.current_user_is_admin());

-- GMAIL CONFIG: server-only table. No public policies = only the secret key (server) can touch it.
```

> ⚠️ Note: `gmail_config` intentionally has **no policies for normal users** — only your backend (using the secret key, which bypasses RLS) should ever read/write it. This is more secure than Firestore's rules ever were, since the Gmail refresh token is sensitive.

**Verify:** In **Authentication → Policies** (or **Table Editor → click a table → Policies tab**), each table should show its listed policies.

### 1.4 Public (unauthenticated) access for the subscribe/unsubscribe portal

**Why:** The `/subscribe` and `/unsubscribe` pages are used by the public (not logged-in staff), but they go through your **backend API routes** (`api/public-subscribe.js`, etc.), which will use the **secret key** — so no special public RLS policy is needed for `subscribers`. The backend bypasses RLS entirely for these routes.

---

## Phase 2 — Replace the Firebase Client Initialization

### 2.1 Remove the old Firebase client file

**Do this:**
```bash
git rm src/firebase.ts
```

**Why:** This file created the Firebase App, Firestore, Auth, and Storage instances. Nothing in the new app should ever import from here again.

### 2.2 Create the new Supabase client file

**Do this:** create `src/supabase.ts`:

```typescript
//
// File: supabase.ts
// Author: <your name>
// Date: <today's date>
// Purpose: Initializes and exports the Supabase client (replaces firebase.ts)
//

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in your .env file');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
```

**Verify:** No TypeScript error appears when you `import { supabase } from './supabase'` anywhere.

### 2.3 Update `vite-env.d.ts`

**Do this:** replace the contents of `src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### 2.4 Update environment variable files

**Do this:** replace `.env.example` contents:

```env
# Google Gemini (unchanged)
VITE_GEMINI_API_KEY=

# Supabase (frontend — safe to expose)
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=

# Supabase (backend/server only — NEVER exposed to the browser)
SUPABASE_URL=
SUPABASE_SECRET_KEY=

# Gmail API OAuth Credentials (Server-side, unchanged)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=
```

Then create your real local `.env` (never commit this one — it's already in `.gitignore`) with your actual values from Phase 0.2.

**Remove:** delete every `VITE_FIREBASE_*` line from `.env.example` — they no longer exist anywhere.

**Verify:** run `npm run dev` — the app should start without "Missing Firebase config" style warnings (you'll still see broken screens until later phases are done — that's expected).

---

## Phase 3 — Migrate Authentication (Firebase Auth → Supabase Auth)

### 3.1 Rewrite `useAuth.tsx`

**Why:** This hook currently listens to `onAuthStateChanged` (Firebase) and reads/writes a `users` Firestore doc. We rewrite it to use `supabase.auth.onAuthStateChange` and the new `profiles` table.

**Do this:** replace the entire contents of `src/hooks/useAuth.tsx`:

```typescript
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
```

**Remove:** the `loginWithEmail`, `signupWithEmail`, and Google Drive access-token code (`googleAccessToken`, `sessionStorage` token handling) — those were tied to `firebase/auth`'s `GoogleAuthProvider().addScope('drive')` pattern which isn't used anywhere else in the app (search confirms `googleAccessToken` is unused downstream). If you find later it *is* needed, Supabase exposes the Google `provider_token` on the session object instead (`session.provider_token`).

### 3.2 Update `AuthScreen.tsx`

**Do this:** open `src/components/AuthScreen.tsx`. No structural changes are needed — it already just calls `login()` from `useAuth()`. Just double check the error-handling branch:

Replace:
```typescript
if (err.code === 'auth/popup-blocked') {
```
with:
```typescript
if (err.message?.includes('popup')) {
```
(Supabase doesn't use Firebase's `err.code` string format.)

**Verify:** Clicking "Continue with Google" opens the Google consent screen, redirects back, and `useAuth()`'s `user` becomes non-null. Check this by temporarily adding `console.log(user)` in `App.tsx`.

---

## Phase 4 — Migrate File Storage (Firebase Storage → Supabase Storage)

### 4.1 Create a Storage bucket

**Do this:**
1. Supabase dashboard → **Storage → New bucket**.
2. Name: `campaign-media`
3. Toggle **Public bucket** → ON (so image URLs work directly in emails, matching the old public Firebase Storage URLs).
4. Click **Create bucket**.

**Verify:** the bucket appears in the Storage list.

### 4.2 Rewrite `api/upload.js`

**Why:** This currently uploads base64 image data to Firebase Storage (with a Firestore fallback). Supabase Storage replaces both — no fallback needed since Supabase Storage doesn't have Firebase's flaky REST quirks.

**Do this:** replace the whole file:

```javascript
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
```

### 4.3 Delete the fallback file that's no longer needed

**Why:** `api/hosted-images.js` only existed to serve images that failed to upload to Firebase Storage and were instead stuffed into a Firestore document as base64. Supabase Storage doesn't have this problem, so this whole file — and the `uploadedImages` idea — is dead code.

**Do this:**
```bash
git rm api/hosted-images.js
```

Also remove its route from `vercel.json`:
```diff
- { "source": "/api/hosted-images", "destination": "/api/hosted-images.js" },
```

And remove the matching Express route block in `server.ts` (both `app.get("/api/hosted-images", ...)` and `app.get("/api/hosted-images/:id", ...)`, plus the `getFirestoreUrl`/`getApiKeyParam` helper calls inside them).

**Verify:** searching the repo for `hosted-images` and `uploadedImages` returns zero results.

### 4.4 Update profile photo uploads

**Why:** `ProfileView.tsx` currently stores the resized photo as a raw base64 string directly inside the Firestore user document (`onUpdateProfile({ photoURL: dataUrl })`). This still technically works after migration (Postgres `text` column can hold a data-URL string), so **no code change is strictly required here** — but it's wasteful. Optionally, upgrade it to upload to the `campaign-media` bucket like other images instead of storing huge base64 strings in the `profiles` table. This is a "nice-to-have," not required for the migration to function.

---

## Phase 5 — Migrate the Backend API Routes

All the `/api/*.js` files (Vercel serverless functions) and `server.ts` currently talk to Firestore using hand-rolled REST calls (`toFirestoreJSON`, `fromFirestoreJSON`, `axios.get`/`patch`/`post` against `firestore.googleapis.com`). This is the biggest chunk of deletion in this migration.

### 5.1 The pattern you'll repeat in every file

**Why:** Every `api/*.js` file has 3 things to change:
1. Delete the Firestore REST helper functions (`getFirestoreUrl`, `getApiKeyParam`, `toFirestoreJSON`, `fromFirestoreJSON`, `getFirestoreRestUrl`).
2. Add one line at the top: create a Supabase client using the **secret key** (server-only, bypasses RLS — this is safe here because these are trusted backend routes).
3. Replace each Firestore REST call with a Supabase query.

```javascript
// Add this near the top of every api/*.js file that touches the database:
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
```

### 5.2 Firestore-call → Supabase-call cheat sheet

| Old Firestore REST pattern | New Supabase pattern |
|---|---|
| `axios.get(getFirestoreRestUrl("subscribers"))` then map docs | `const { data } = await supabase.from('subscribers').select('*')` |
| Find by email: fetch all docs, `.find()` in JS | `const { data } = await supabase.from('subscribers').select('*').ilike('email', email).maybeSingle()` |
| `axios.patch(...)` to update a doc | `await supabase.from('subscribers').update({ status: 'active' }).eq('id', existing.id)` |
| `axios.post(...)` to create a doc | `await supabase.from('subscribers').insert({ name, email, status, tags })` |
| `axios.delete(...)` | `await supabase.from('subscribers').delete().eq('id', id)` |
| `doc.id` (Firestore auto ID) | `.select().single()` after insert returns the row's real `id` (a UUID) |

### 5.3 Rewrite `api/public-subscribe.js`

**Do this:** replace the Firestore-touching section. Key excerpt (the Gmail-sending logic is untouched):

```javascript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

// ... inside the handler, replacing the old "fetch all + find" block:
const { data: existing } = await supabase
  .from('subscribers')
  .select('*')
  .ilike('email', email)
  .maybeSingle();

const verificationToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

if (existing) {
  const mergedTags = Array.from(new Set([...(existing.tags || []), ...finalTags]));
  await supabase.from('subscribers').update({
    name: name || existing.name,
    status: 'pending',
    tags: mergedTags,
    verification_token: verificationToken,
    verification_expires_at: verificationExpiresAt
  }).eq('id', existing.id);
} else {
  await supabase.from('subscribers').insert({
    name, email, status: 'pending', tags: finalTags,
    added_by: 'public-portal',
    verification_token: verificationToken,
    verification_expires_at: verificationExpiresAt
  });
}
```

Delete: `getFirestoreUrl`, `getApiKeyParam`, `getFirestoreRestUrl`, `toFirestoreJSON`, `fromFirestoreJSON` from this file — none are used anymore.

Repeat the same "find/update/insert" pattern for **`api/public-verify.js`** and **`api/public-unsubscribe.js`** (they follow the identical shape).

### 5.4 Rewrite `api/gmail.js`

**Do this:** replace the `getGmailConfig`/`saveGmailConfig` functions:

```javascript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function getGmailConfig() {
  const { data } = await supabase.from('gmail_config').select('*').eq('id', 1).maybeSingle();
  return data || { connected: false };
}

async function saveGmailConfig(config) {
  await supabase.from('gmail_config').update({
    connected: config.connected,
    authorized_email: config.authorizedEmail,
    access_token: config.accessToken,
    refresh_token: config.refreshToken,
    token_expiry: config.tokenExpiry
  }).eq('id', 1);
}
```

Replace `createEmailLog(campaignId, recipientEmail, details)`:
```javascript
async function createEmailLog(campaignId, recipientEmail, details) {
  await supabase.from('email_logs').insert({
    campaign_id: campaignId,
    recipient_email: recipientEmail,
    status: details.status,
    error_message: details.errorMessage,
    sent_at: details.sentAt,
    gmail_message_id: details.gmailMessageId
  });
}
```

Replace `updateCampaignCount(campaignId, status, sentCount, failedCount)`:
```javascript
async function updateCampaignCount(campaignId, status, sentCount, failedCount) {
  const updates = { status, sent_count: sentCount, failed_count: failedCount };
  if (status === 'sent') updates.sent_at = new Date().toISOString();
  await supabase.from('email_campaigns').update(updates).eq('id', campaignId);
}
```

In the `send-bulk` handler, replace fetching the campaign doc:
```javascript
const { data: campaign } = await supabase
  .from('email_campaigns').select('*').eq('id', campaignId).maybeSingle();
if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
// campaign.attachments_json, campaign.subject, campaign.body — same field names, just snake_case
```

**Delete** every `toFirestoreJSON` / `fromFirestoreJSON` / `getFirestoreUrl` / `getApiKeyParam` function and the axios interceptor block at the top that retried Firestore 429s (that retry logic was Firestore-specific quota handling — Supabase doesn't need it, so remove it entirely).

### 5.5 Rewrite `api/cron.js`

Apply the same conversions as 5.4:
- `getGmailConfig`/`saveGmailConfig` → same as above.
- `fetchScheduledCampaigns()`:
  ```javascript
  async function fetchScheduledCampaigns() {
    const { data } = await supabase.from('email_campaigns').select('*').eq('status', 'scheduled');
    return data || [];
  }
  ```
- `fetchFirestoreCollection("subscribers")` → `const { data } = await supabase.from('subscribers').select('*');`
- Remove the entire in-memory `firestoreCache` object and `CACHE_TTL_MS` logic — this was working around Firestore's REST rate limits (429 errors). Postgres via Supabase does not have this problem at this app's scale, so this caching layer is unnecessary complexity to delete.
- Remove `updateImportedPostStatus` only if you don't have a `posts` table (see note in Phase 7 about the Content Calendar `posts` collection, which is referenced by `App.tsx`/`server.ts` but was never defined in `firestore.rules` provided — confirm with your team whether that collection is in scope; if yes, add a `posts` table using the same conversion pattern).

### 5.6 Rewrite `api/facebook-post.js`, `api/meta-post.js`, `api/facebook-page-info.js`

**Why:** These files talk to the Facebook Graph API only — they never touch Firestore. **No changes needed.** Leave them exactly as-is.

### 5.7 Rewrite `server.ts` (local dev server)

Apply the exact same conversions as `api/gmail.js` and `api/cron.js` to the matching functions inside `server.ts` (`getGmailConfig`, `saveGmailConfig`, `createEmailLog`, `updateCampaignCount`, `fetchFirestoreCollection`, `fetchScheduledCampaigns`, `fetchPendingSubscribers`, and the `/api/public/subscribe`, `/api/public/verify`, `/api/public/unsubscribe` route bodies).

**Delete entirely** from `server.ts`:
- The `getSystemAuthToken()` function and its Firebase-specific "self-provisioning system-cron account" logic (signs up a fake Firebase Auth user just so Firestore rules allow cron access). This entire pattern is Firestore-rules-specific and has no Supabase equivalent — **you don't need it at all**, because your server already uses the Supabase **secret key**, which bypasses RLS completely and needs no fake user account.
- The `axios.interceptors.request.use(...)` block that injected the Firebase auth token into every Firestore call.
- The `axios.interceptors.response.use(...)` 429-retry block (same reasoning as 5.5).
- The `getDynamicFirebaseConfigScript()` function and the middleware block that injects `window.__FIREBASE_CONFIG__` into `index.html`. Supabase's URL/key are just build-time `VITE_` env vars — no runtime injection needed.

**Verify after 5.1–5.7:** Search the entire repo for the string `firestore.googleapis.com` — it should return **zero** results. Also search for `toFirestoreJSON` and `fromFirestoreJSON` — zero results.

---

## Phase 6 — Migrate the Frontend Components

This is the largest phase by file count, but every file follows one of three repeating patterns. Learn the 3 patterns once, then apply them file-by-file.

### 6.1 Pattern A — Real-time list (`onSnapshot` → Supabase Realtime)

**Old (Firestore), e.g. in `SubscribersView.tsx`:**
```typescript
useEffect(() => {
  const unsub = onSnapshot(collection(db, 'subscribers'), (snapshot) => {
    const list = [];
    snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
    setSubscribers(list);
  });
  return () => unsub();
}, []);
```

**New (Supabase):**
```typescript
useEffect(() => {
  // 1. Load the current data once
  const loadInitial = async () => {
    const { data } = await supabase.from('subscribers').select('*').order('added_at', { ascending: false });
    setSubscribers(data || []);
    setLoading(false);
  };
  loadInitial();

  // 2. Subscribe to live changes (insert/update/delete) — this replaces onSnapshot
  const channel = supabase
    .channel('subscribers-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'subscribers' }, () => {
      loadInitial(); // simplest approach: just re-fetch everything on any change
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);
```

> 🐍 Python analogy: `onSnapshot` was like a generator that yields a new list every time the data changes. Supabase's realtime channel is a pub/sub "event happened" signal — you re-run your normal `select()` query in response, rather than the data being streamed to you automatically.

**Enable Realtime for a table (one-time setup, do this for every table you want live updates on — `subscribers`, `email_campaigns`, `notifications`, `email_templates`, `concerns`):**
```sql
alter publication supabase_realtime add table public.subscribers;
alter publication supabase_realtime add table public.email_campaigns;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.email_templates;
alter publication supabase_realtime add table public.concerns;
```
Run this once in the SQL Editor.

**Files using this pattern (apply Pattern A to each):**
`SubscribersView.tsx`, `TemplatesView.tsx`, `CampaignsListView.tsx`, `SentHistoryView.tsx`, `DashboardView.tsx`, `NotificationDropdown.tsx` (via `notificationService.ts`), `AdminView.tsx` (concerns list), `HelpView.tsx` (concerns list), `RoleManager.tsx` (users, pending users, role_assignments), `App.tsx` (quick_links settings listener).

### 6.2 Pattern B — One-time read / write (no live updates needed)

**Old:**
```typescript
const docSnap = await getDoc(doc(db, 'settings', 'quick_links'));
if (docSnap.exists()) setQuickLinks(docSnap.data().links);
```

**New:**
```typescript
const { data } = await supabase.from('settings').select('value').eq('key', 'quick_links').maybeSingle();
if (data) setQuickLinks(data.value.links);
```

**Old write:**
```typescript
await setDoc(doc(db, 'settings', 'quick_links'), { links: quickLinks });
```

**New write:**
```typescript
await supabase.from('settings').upsert({ key: 'quick_links', value: { links: quickLinks } });
```

**Files using this pattern:** `SettingsView.tsx` (quick_links load/save, backup/restore JSON export using `select('*')` per table instead of per Firestore collection).

### 6.3 Pattern C — Create/Update/Delete a single row

| Old Firestore call | New Supabase call |
|---|---|
| `addDoc(collection(db, 'subscribers'), data)` | `await supabase.from('subscribers').insert(data)` |
| `setDoc(doc(db, 'subscribers', id), data, { merge: true })` | `await supabase.from('subscribers').update(data).eq('id', id)` |
| `deleteDoc(doc(db, 'subscribers', id))` | `await supabase.from('subscribers').delete().eq('id', id)` |
| `writeBatch(db)` + `batch.set/delete` + `batch.commit()` | Build an array and use `.upsert([...])` / `.delete().in('id', [...ids])` for bulk operations — Postgres does this in one round trip, no manual batching needed |

**Example — `SubscribersView.tsx`'s `handleBulkDelete`:**
```typescript
// Old
const batch = writeBatch(db);
selectedSubIds.forEach(id => batch.delete(doc(db, 'subscribers', id)));
await batch.commit();

// New
await supabase.from('subscribers').delete().in('id', selectedSubIds);
```

**Files using this pattern:** `SubscribersView.tsx`, `TemplatesView.tsx`, `ComposeCampaignView.tsx`, `CampaignsListView.tsx`, `RoleManager.tsx`, `AdminView.tsx`, `HelpView.tsx`.

### 6.4 Field naming — camelCase vs snake_case

**Why this matters:** Firestore didn't care about naming convention; Postgres columns in this guide are `snake_case` (e.g. `display_name`), but your TypeScript types (`types.ts`) are `camelCase` (e.g. `displayName`). You must translate between the two at the boundary — right where you call `supabase.from(...).select()`.

**Do this everywhere:** write a small "mapper" function per entity, next to where you fetch it (see `mapProfile` example in Phase 3.1). Do **not** rename your TypeScript types — keep the frontend `camelCase` and only translate at the data-fetching boundary. This keeps all your existing JSX/props code (which expects `sub.name`, `sub.email`, `campaign.sentCount`, etc.) working unchanged.

Example for subscribers in `SubscribersView.tsx`:
```typescript
function mapSubscriber(row: any): Subscriber {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    status: row.status,
    tags: row.tags || [],
    addedAt: row.added_at,
    addedBy: row.added_by,
    unsubscribeReason: row.unsubscribe_reason,
    unsubscribedAt: row.unsubscribed_at,
    verifiedAt: row.verified_at
  };
}
```

### 6.5 Update `App.tsx`

- Replace `import { auth, db } from './firebase'` → `import { supabase } from './supabase'`.
- Replace the Quick Links `onSnapshot(doc(db, 'settings', 'quick_links'), ...)` with Pattern A/B combined (one-time load + realtime subscription on the `settings` table filtered by `key = 'quick_links'`).
- Replace the `postId` deep-link handler's `getDoc(doc(db, 'posts', postId))` with `supabase.from('posts').select('*').eq('id', postId).maybeSingle()` **if** you decide to migrate the `posts` collection (see Phase 5.5 note — confirm scope with your lead since `posts` isn't in the provided `firestore.rules`, it may belong to a separate Content Planner app sharing the same database).

### 6.6 Update `notificationService.ts`

**Do this:** replace the whole file's Firestore logic with Supabase equivalents, keeping the same exported function names (`sendInAppNotification`, `subscribeToNotifications`, `markNotificationAsRead`, `markAllNotificationsAsRead`, `deleteNotification`) so no other file needs to change its imports.

```typescript
import { supabase } from '../supabase';
import { InAppNotification } from '../types';

export async function sendInAppNotification(data: {
  title: string; message: string; type?: string; userId?: string;
}) {
  await supabase.from('notifications').insert({
    title: data.title,
    message: data.message,
    type: data.type || 'info',
    user_id: data.userId || null,
    read: false
  });
}

export function subscribeToNotifications(onUpdate: (list: InAppNotification[]) => void) {
  const load = async () => {
    const { data } = await supabase
      .from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    onUpdate((data || []).map(mapNotification));
  };
  load();

  const channel = supabase
    .channel('notifications-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, load)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

export async function markNotificationAsRead(id: string) {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsAsRead(notifications: InAppNotification[]) {
  const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
  if (unreadIds.length) await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
}

export async function deleteNotification(id: string) {
  await supabase.from('notifications').delete().eq('id', id);
}

function mapNotification(row: any): InAppNotification {
  return {
    id: row.id, title: row.title, message: row.message, type: row.type,
    userId: row.user_id, read: row.read, createdAt: row.created_at
  };
}
```

**Delete:** the "isolated notifications database" fallback pattern (`notificationsDb`) from `firebase.ts` no longer exists — there's only one Supabase project/database, so remove any references to a second database entirely.

### 6.7 Full checklist of frontend files to update

Go through each file and replace its Firestore imports/calls using Patterns A/B/C above:

- [ ] `src/App.tsx`
- [ ] `src/hooks/useAuth.tsx` *(done in Phase 3)*
- [ ] `src/services/notificationService.ts` *(done in 6.6)*
- [ ] `src/components/SubscribersView.tsx`
- [ ] `src/components/TemplatesView.tsx`
- [ ] `src/components/CampaignsListView.tsx`
- [ ] `src/components/ComposeCampaignView.tsx`
- [ ] `src/components/SentHistoryView.tsx`
- [ ] `src/components/DashboardView.tsx`
- [ ] `src/components/SettingsView.tsx`
- [ ] `src/components/RoleManager.tsx`
- [ ] `src/components/AdminView.tsx`
- [ ] `src/components/HelpView.tsx`
- [ ] `src/components/NotificationDropdown.tsx` *(only imports from notificationService — check for direct `db` imports, remove if found)*

**In every one of these files:** delete the line `import { db, auth } from '../firebase';` (or similar) and delete any leftover `import { collection, doc, onSnapshot, ... } from 'firebase/firestore'` lines. Replace with `import { supabase } from '../supabase';`.

---

## Phase 7 — Cleanup: Remove Every Trace of Firebase

This phase exists specifically to satisfy "no unnecessary code left over." Go through this list in order.

### 7.1 Remove the Firebase npm package

```bash
npm uninstall firebase
```

**Verify:** open `package.json` — the `"firebase": "^12.16.0"` line under `dependencies` is gone.

### 7.2 Delete Firebase-only files

```bash
git rm firestore.rules
git rm src/firebase.ts   # if not already removed in Phase 2
```

### 7.3 Search-and-destroy leftover references

Run each of these searches from your project root and fix every result:

```bash
grep -rn "firebase" --include="*.ts" --include="*.tsx" --include="*.js" .
grep -rn "firestore" --include="*.ts" --include="*.tsx" --include="*.js" .
grep -rn "getAuth\|GoogleAuthProvider\|onAuthStateChanged" --include="*.ts" --include="*.tsx" .
grep -rn "onSnapshot\|collection(db\|doc(db\|addDoc\|setDoc\|updateDoc\|deleteDoc\|writeBatch" --include="*.tsx" .
```

Every single match must either:
(a) be updated to the Supabase equivalent (if you missed a file in Phase 6), or
(b) be deleted (if it was Firestore-only workaround logic like the retry/cache/self-auth blocks called out in Phase 5).

**Verify:** all four `grep` commands above return **zero matches**.

### 7.4 Clean up `vercel.json`

Remove the `hosted-images` rewrite rule (done in 4.3). Everything else stays the same — routes to `api/gmail.js`, `api/cron.js`, `api/public-*.js`, `api/facebook-post.js`, `api/meta-post.js` are unaffected by this migration (they're just calling different code inside, not different URLs).

### 7.5 Clean up `docs/` and `AGENTS.md` mentions

Search `docs/operations_guide.md` and `docs/app_creation_guidelines.md` for the words "Firebase," "Firestore," and "Google Cloud Console → Firestore" instructions, and update the setup instructions there to describe the new Supabase project/env-var setup from Phase 0, so future developers reading the docs aren't misled.

### 7.6 Update `README.md`

Update the **Tech Stack**, **Database & Storage**, and **Environment Variables** sections to describe Supabase instead of Firebase (replace `VITE_FIREBASE_*` lines with the `VITE_SUPABASE_*`/`SUPABASE_*` lines from Phase 2.4).

---

## Phase 8 — Update the Deployment Environment

### 8.1 Vercel environment variables

**Do this:** In Vercel dashboard → your project → **Settings → Environment Variables**:

**Remove:**
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_DATABASE_ID
```

**Add** (values from Phase 0.2):
```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL
SUPABASE_SECRET_KEY
```

**Keep unchanged:** `VITE_GEMINI_API_KEY`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`, `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`.

**Verify:** trigger a redeploy after saving. Check the deployment logs for any "undefined" env var warnings.

### 8.2 Update Supabase Auth's allowed redirect URL for production

**Do this:** back in Supabase → **Authentication → URL Configuration**, add your real production domain (e.g. `https://stlaf-marketing-newsletter.vercel.app/**`) to **Redirect URLs**, since this is separate from the Google Cloud OAuth redirect URI set in Phase 0.4.

### 8.3 Update Google Cloud authorized origins

**Do this:** in Google Cloud Console → your OAuth Client → **Authorized JavaScript origins**, add your production domain (no path, no trailing slash), e.g. `https://stlaf-marketing-newsletter.vercel.app`.

---

## Phase 9 — Data Migration (moving the actual existing records)

If this app already has real subscribers/campaigns in production Firestore, you need to move that data, not just the schema.

### 9.1 Export from Firestore

**Do this:**
1. Go to Google Cloud Console → **Firestore → Import/Export**.
2. Click **Export**, choose a Cloud Storage bucket, and select all collections (or leave blank for "all").
3. Wait for the export job to finish, then download the exported files, OR use `gcloud firestore export` from the CLI:
   ```bash
   gcloud firestore export gs://your-export-bucket
   ```

### 9.2 Convert and import into Supabase

**Why:** Firestore's export format isn't directly SQL-compatible; the simplest path for a small dataset (a few thousand rows) is to write a one-off Node script that reads each collection via the Firebase Admin SDK (temporarily, just for this migration script) and inserts rows into Supabase.

**Do this:** create a throwaway script `scripts/migrate-data.mjs` (delete it after running, per the "no leftover code" rule):

```javascript
// scripts/migrate-data.mjs — RUN ONCE, THEN DELETE THIS FILE
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
const firestoreDb = admin.firestore();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function migrateSubscribers() {
  const snapshot = await firestoreDb.collection('subscribers').get();
  const rows = snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      name: d.name || 'Anonymous',
      email: d.email,
      status: d.status || 'active',
      tags: Array.isArray(d.tags) ? d.tags : [],
      added_at: d.addedAt || new Date().toISOString(),
      added_by: d.addedBy || 'migration',
      unsubscribe_reason: d.unsubscribeReason || null,
      unsubscribed_at: d.unsubscribedAt || null,
      verified_at: d.verifiedAt || null
    };
  });
  const { error } = await supabase.from('subscribers').insert(rows);
  if (error) console.error('subscribers migration error:', error);
  else console.log(`Migrated ${rows.length} subscribers`);
}

// Repeat a similarly-shaped function for: email_templates, email_campaigns,
// email_logs, notifications, concerns — matching each collection's fields
// to its snake_case table columns from Phase 1.2.

await migrateSubscribers();
process.exit(0);
```

**Note on `firebase-admin`:** this is a **temporary dev-only dependency**, installed just to run this one script:
```bash
npm install --no-save firebase-admin
```
Because you used `--no-save`, it won't be added to `package.json` — confirm after running that `package.json` still has zero mentions of `firebase`.

**Do this:**
1. Get a Firebase service account key: Firebase Console → **Project Settings → Service Accounts → Generate new private key**. Save the JSON somewhere temporary, **never commit it**.
2. Run: `FIREBASE_SERVICE_ACCOUNT_JSON="$(cat serviceAccount.json)" SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/migrate-data.mjs`
3. Repeat, adding a migration function per collection, until all data is copied.

### 9.3 Migrate existing users (Firebase Auth → Supabase Auth)

**Why:** User accounts can't be copied with a simple insert — passwords/OAuth identities are provider-specific. Since this app **only uses Google Sign-In** (no email/password), the good news is: your existing staff can simply **sign in again** with the same Google account after deployment, and the `useAuth.tsx` code from Phase 3.1 will auto-create their `profiles` row — matched by email against `role_assignments`, exactly like it worked with Firestore. **No manual user migration script is required** — just make sure the `role_assignments` table (Phase 1.2) is pre-populated with the same emails/roles that existed in the old Firestore `roleAssignments` collection before your staff logs in again, so they land as `active` immediately instead of `pending`.

**Do this:** for each row in the old `roleAssignments` Firestore collection, insert a matching row:
```sql
insert into public.role_assignments (email, role, department) values
  ('someone@example.com', 'marketing_supervisor', 'Marketing'),
  ('another@example.com', 'marketing_member', 'Marketing');
```

### 9.4 Delete the migration script and service account key

```bash
rm scripts/migrate-data.mjs
rm serviceAccount.json   # if it was ever placed in the project folder
```

**Verify:** `git status` shows no migration script or key file lingering, and `git log` never had them committed (if they were, rotate the service account key immediately in Firebase Console).

---

## Phase 10 — Final Testing Checklist

Run through this list manually before considering the migration done.

- [ ] Google Sign-In works end-to-end; a brand-new email lands on the "Pending Approval" screen.
- [ ] An admin can approve a pending user from **RoleManager**, and their `profiles.status` updates to `active` in the Supabase Table Editor.
- [ ] Creating, editing, and deleting a subscriber in **SubscribersView** immediately reflects in the Supabase **Table Editor** (and in another open browser tab, thanks to Realtime).
- [ ] CSV import/export in **SubscribersView** still works.
- [ ] Creating a campaign in **ComposeCampaignView**, saving as draft, and sending it dispatches through Gmail and creates rows in `email_logs`.
- [ ] Uploading an inline image in the campaign composer returns a public Supabase Storage URL and displays correctly.
- [ ] The public `/subscribe` page creates a `pending` row and — if Gmail is connected — sends a verification email whose link hits `/api/public/verify` and flips the row to `active`.
- [ ] The public `/unsubscribe` page updates `status` to `unsubscribed` and records the reason.
- [ ] Notifications appear in the bell icon in real time when another user performs an action.
- [ ] The **Backup/Export** button in Settings produces a JSON with all Supabase tables (update its collection list to the new table names).
- [ ] `npm run build` completes with zero TypeScript errors.
- [ ] All four `grep` commands from Phase 7.3 return zero results.
- [ ] The deployed Vercel app works with only the new Supabase-based env vars set (double-check by temporarily removing any lingering `VITE_FIREBASE_*` var if you find one still set in Vercel).

---

## Appendix: Every File Touched, at a Glance

| Action | File |
|---|---|
| ❌ Delete | `src/firebase.ts`, `firestore.rules`, `api/hosted-images.js` |
| ➕ Create | `src/supabase.ts` |
| ✏️ Rewrite | `src/hooks/useAuth.tsx`, `src/services/notificationService.ts`, `api/upload.js`, `api/gmail.js`, `api/cron.js`, `api/public-subscribe.js`, `api/public-verify.js`, `api/public-unsubscribe.js`, `server.ts` |
| ✏️ Update imports/calls only | `src/App.tsx`, `src/components/SubscribersView.tsx`, `src/components/TemplatesView.tsx`, `src/components/CampaignsListView.tsx`, `src/components/ComposeCampaignView.tsx`, `src/components/SentHistoryView.tsx`, `src/components/DashboardView.tsx`, `src/components/SettingsView.tsx`, `src/components/RoleManager.tsx`, `src/components/AdminView.tsx`, `src/components/HelpView.tsx`, `src/components/AuthScreen.tsx`, `src/vite-env.d.ts`, `.env.example`, `vercel.json`, `package.json`, `README.md`, `docs/*.md` |
| ⏸️ No change needed | `api/facebook-post.js`, `api/meta-post.js`, `api/facebook-page-info.js`, `src/types.ts` (keep camelCase), `src/constants.tsx`, `src/services/geminiService.ts`, all purely-presentational components (`LoadingScreen.tsx`, `PrivacyPolicy.tsx`, `TermsOfService.tsx`, `DataDeletion.tsx`, `ConfirmationModal.tsx`, `NotificationToast.tsx`) |
