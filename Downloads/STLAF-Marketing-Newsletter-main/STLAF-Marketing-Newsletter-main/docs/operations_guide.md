<!--
File: operations_guide.md
Author: AI Assistant
Date: 2026-06-22
Purpose: Complete system manual outlining setup, migration/transfer, usage instructions, and maintenance protocols
-->

# Web Application Operations Guide

Welcome to the operations and system administration guide for this application. This document provides a comprehensive blueprint of the system's architecture, local and cloud setup, migration and transfer protocols, daily usage workflows, and maintenance advice.

---

## 1. System Architecture Overview

This webapp is built on a full-stack, decoupled architecture utilizing React on the browser and Express on the backend, linked through seamless API and client routes.

- **Frontend (Client)**: 
  - Single Page Application (SPA) driven by **React 18+** and compiled via **Vite**.
  - Styled with **Tailwind CSS** styled utility components with strict dark-mode adjustments (Twilight Theme).
  - Handles client-side routing, modular dialog cards (e.g. template editors, bulk CSV uploads), and animations powered by **motion** (`motion/react`).
- **Backend (Server)**:
  - **Node.js with Express** framework.
  - Hosts backend proxy routes under `/api/*` to guarantee client-side secrets and access keys are kept completely invisible to the browser.
  - Implements background services such as scheduled post queues, transactional email generation, and rate-limiting retry protocols.
- **Database & Identity Layer**:
  - **Google Firebase Firestore** as the resilient, real-time NoSQL database.
  - **Firebase Authentication** mapped with Google Single Sign-On (SSO) for authentication, utilizing custom rule sets (`firestore.rules`) to handle dynamic user roles (Administrators, Editors, and Subscribers).
- **Core Integrations**:
  - **Gmail OAuth Node client**: Connects securely to the Google API using dynamic authorization tokens to dispatch scheduled emails directly.
  - **Meta Graph API (Facebook & Instagram)**: Publishers directly to social media page feeds via token-based endpoints.
  - **Gemini API (`@google/genai`)**: Server-side AI assistant creating marketing captions, newsletters, and custom templates dynamically.

---

## 2. Setup and Installation

### Prerequisites
Before configuring or launching the app, ensure you have:
1. **Node.js** (v18.0.0 or higher recommended)
2. **NPM** (bundled with Node.js)
3. A **Google Cloud Console** account with active project permissions.
4. A **Firebase Core Console** project matching your Google Cloud ecosystem.
5. A **Meta for Developers** portal account (if Meta publishing features are desired).

### Step 2.1: Clone and Local Setup
1. Unzip or clone the repository to your workspace.
2. Initialize and download the base dependencies:
   ```bash
   npm install
   ```

### Step 2.2: Environment Variables Configuration
Duplicate `.env.example` to create `.env` in your root folder. Fill out the variables accurately:

```env
# Server Ingress Port (Nginx reverse-proxy routes to 3000 by default)
PORT=3000

# Google Cloud & Firebase Web Clients configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
VITE_FIREBASE_APP_ID=your_firebase_app_id_here

# Backend Secret API Configuration
GEMINI_API_KEY=your_google_gemini_api_key_here

# Google OAuth Credentials (for Gmail API dispatching)
GOOGLE_CLIENT_ID=your_google_oauth_client_id_here
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/callback
```

### Step 2.3: Firebase Firestore Configuration
1. Head to the **Firebase Console**, create or select your project.
2. Under **Build**, select **Firestore Database** and initialize it in Europe or US region.
3. Apply the security rules defined inside `/firestore.rules` locally to regulate user roles:
   - Navigating to the **Rules** tab in Firebase and pasting the file contents, or running the Firebase CLI:
     ```bash
     firebase deploy --only firestore:rules
     ```
4. Enable **Firebase Authentication** and turn on the **Google Sign-In** provider. Ensure to whitelist your local domain URL (`localhost` or server IP address) and the production domain inside the Authentication Authorized Domains registry.

### Step 2.4: Google Workspace & Gmail OAuth
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Gmail API** inside the API Library.
3. Head to the **OAuth Consent Screen** tab:
   - Set User Type to *External*.
   - Add authorized scopes: `https://www.googleapis.com/auth/gmail.send`.
4. Register credentials under the **Credentials** tab:
   - Create an *OAuth Client ID* (Web Application type).
   - Add **Authorized Redirect URIs**: `http://localhost:3000/api/gmail/callback` (or your customized server hostname endpoint).
   - Note the generated client ID and client secret, then copy them inside `.env`.

---

## 3. How to Use the System

The application runs in multiple contexts based on the roles defined within the Firestore hierarchy:

### System Roles
- **Administrator**: Controls user verification permissions, Whitelist mappings, system backups, and databases logs.
- **Marketing (Editor)**: Creates, designs, schedules, and monitors email marketing campaigns or Meta social media posts. Can also import prospective contacts, draft HTML blocks, and use Gemini to generate copy text.
- **Subscriber**: Users subscribing via the public-facing subscription portal, receiving confirmation tokens via email to safely verify subscriptions.

### Typical Campaign Workflow
1. **Design Campaign Content**:
   - Access **Templates** inside the web dashboard to draft reusable blocks.
   - Input guidelines or topics into the **AI Creator input** and invoke **Gemini API** to fetch suggested subject lines, structural summaries, and copy suggestions.
2. **Setup Subscribers**:
   - Navigate to **Subscribers** and upload a CSV containing subscriber contacts (`email, first_name, last_name, tags`).
   - Trigger optional validation verification emails for unverified subscribers.
3. **Dispatch & Schedule**:
   - Inside the **Compose** screen, assign lists by tags, configure template styling, and choose immediate dispatch or schedule it for a future date.
   - For Meta posts (Facebook & Instagram), fill out caption metrics, attach required assets links, and execute.
4. **Inspect Metrics**:
   - Monitor live records on the **Dashboard** including overall open/click percentages, active subscribers metrics, and event log tickers.

---

## 4. App Transfer & Migration Guide

When transferring this application from one developer, server server system, or environment hosting model to another (e.g. Cloud Run, Vercel, VPS, or localized servers), perform these precise steps to prevent downtime or database access disruption:

### Step 4.1: Database Migration / Replication
1. **Setting preservation**: Navigate to the administrator panel's **Backup & Restore Panel**.
2. **Download Current Configuration**: Back up settings lists, email rules, and system schemas directly as a structured JSON.
3. **Data Cloning**: If migrating database servers entirely:
   - Go to Google Cloud Storage console of the source project.
   - Run a Firestore Export to an export bucket:
     ```bash
     gcloud firestore export gs://source-project-backup-bucket
     ```
   - Import the exported bucket file to the destination Firestore instance.

### Step 4.2: Domain Whitelists and Callback URLs
1. When migrating/transferring host names (e.g., from `https://old-domain.com` to `https://new-domain.com`):
   - Update **Google OAuth Client consent URI** in the Google Cloud Console to match:
     `https://new-domain.com/api/gmail/callback`
   - Update the environmental redirect callback configurations:
     `GOOGLE_REDIRECT_URI=https://new-domain.com/api/gmail/callback`
   - Add the new domain to the **Authorized Domains list** inside **Firebase Console** -> **Authentication** -> **Settings**.

### Step 4.3: Package Bundler Deployment Execution
This codebase supports production builds out of the box. Ensure the pipeline deploys using these Node scripts:
```bash
# Compile client-side static code and bundle native server logic as Single CommonJS script
npm run build

# Start the compiled high-performance Node processes
npm start
```

---

## 5. System Maintenance and Troubleshooting

### 5.1: Background Scheduler Maintenance
Automatic mail dispatch relies on Cron scheduler cycles invoking the endpoint `/api/cron` periodically.
- Out of server containers, bind this route to a Cron task executor (such as Webcron, Google Cloud Scheduler, or standard shell crontab):
  ```bash
  */10 * * * * curl -s https://your-production-domain.com/api/cron > /dev/null
  ```
- Alternatively, the Express backend runs an internal lightweight ticker loop that guarantees cron operations will be simulated in real-time when running consistently inside memory.

### 5.2: Structured Failure Log Analysis
Every REST endpoint, mail sender transaction, and database write operation utilizes standardized logging patterns:
- **INFO**: Standard workflow transitions, like user logouts or successfully resolved jobs.
- **WARN**: Transcoding alerts, soft rate limits from Meta APIs, or network retries.
- **ERROR**: Database query failures, OAuth token exhaustion, or invalid input validations.

Check Node standard console logs or your cloud ingress outputs (e.g., Google Cloud Logging) using the search criteria:
```text
level="ERROR" OR "auth/invalid-credential"
```

### 5.3: Handling Typical Roadblocks

| Symptom / Error | Root Cause | Solution |
| :--- | :--- | :--- |
| **"auth/invalid-api-key"** inside console | Incorrect project IDs or stale web keys declared within the `.env`. | Re-verify your Firebase Configuration block, deploy rules, and ensure the `.env` variables have been updated dynamically. |
| **Gmail Send Fails with 401 Unauthorized** | The Google access token has expired or credentials have been manually revoked inside the Google Account permissions panel. | Re-authenticate the server interface by navigating to Admin Settings, launching the Google OAuth sequence, and confirming consent permissions. |
| **Rate Limit / API quota exceeded** | Meta or Google Graph APIs throttling batch operations due to excess messaging. | The system handles this natively on its server layer via progressive exponential backoff logic (with delayed retries), but for mass transactions, check billing limits. |

---
*For additional developer questions or visual styling rules, refer to `/docs/app_creation_guidelines.md`.*
