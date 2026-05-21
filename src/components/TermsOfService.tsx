import React from 'react';
import { FileText, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';

export const TermsOfService = () => {
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
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Terms of Service</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Effective Date: May 8, 2026</p>
            </div>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-slate-600 dark:text-slate-300">
            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Marketing Operations Portal ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">2. Use of Service</h2>
              <p>
                You are responsible for all activities that occur under your account. You agree to use the Service only for lawful purposes and in accordance with these Terms. You must:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>Provide accurate and complete registration information.</li>
                <li>Maintain the security of your account identifiers.</li>
                <li>Comply with all applicable local, state, national, and international laws.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">3. Content and Conduct</h2>
              <p>
                You retain ownership of the content you post to the Service. However, by using the Service, you grant us a license to host, store, and display your content to provide the Service to you and your organization. We reserve the right to remove any content that violates these Terms or is otherwise objectionable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">4. Third-Party Integrations</h2>
              <p>
                The Service integrates with platforms like Facebook and Instagram. Your use of these integrations is also subject to the respective terms and conditions of those platforms (e.g., Meta's Terms of Service). We are not responsible for the availability or conduct of these third-party services.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">5. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, Marketing Operations Portal shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">6. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify you of any changes by updating the "Effective Date" at the top of this page. Your continued use of the Service after changes are posted constitutes your acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">7. Contact Information</h2>
              <p>
                Questions about the Terms of Service should be sent to cbalvarado@sadsadtamesislaw.com.
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
