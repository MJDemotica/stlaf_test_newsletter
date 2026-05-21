import React from 'react';
import { Shield, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';

export const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-amber-100 dark:selection:bg-amber-900/30">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden"
      >
        <div className="p-8 sm:p-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Privacy Policy</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Effective Date: May 8, 2026</p>
            </div>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-slate-600 dark:text-slate-300">
            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">1. Introduction</h2>
              <p>
                Welcome to Marketing Operations Portal ("we," "our," or "us"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application to manage marketing tasks and social media integrations, including Facebook and Instagram.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">2. Information Collection</h2>
              <p>
                We collect information that you provide directly to us when using the portal. This includes:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>Account Information: Name, email address, and profile details.</li>
                <li>Content Data: Marketing tasks, captions, images, and schedules you create.</li>
                <li>Third-Party Data: When you link your Facebook/Instagram accounts, we access specific information needed for posting (Page tokens, IDs, and media).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">3. Use of Information</h2>
              <p>
                The information we collect is used solely to:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>Provide and maintain the Service.</li>
                <li>Facilitate social media publishing via Meta Graph APIs.</li>
                <li>Manage user roles and permissions within the organization.</li>
                <li>Notify you about relevant task updates or approval requests.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">4. Facebook Data</h2>
              <p>
                Our application integrates with Facebook services. We do not store your Facebook password. We use official Meta OAuth flows to obtain access tokens that allow the application to post on your behalf to authorized Pages. You can revoke these permissions at any time through your Facebook account settings.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">5. Data Deletion</h2>
              <p>
                Users can request deletion of their data at any time. When an account is deleted, all associated personal information and platform-specific tokens are permanently removed from our systems. Facebook-specific data access can be disconnected via the Facebook App settings.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">6. Contact Us</h2>
              <p>
                If you have questions or concerns about this Privacy Policy, please contact us at cbalvarado@sadsadtamesislaw.com.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
            <button 
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState(null, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="flex items-center gap-2 text-sm font-medium text-amber-500 hover:text-amber-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Go Back
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
