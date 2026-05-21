import React from 'react';
import { Trash2, ChevronLeft, Mail, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

export const DataDeletion = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-amber-100 dark:selection:bg-amber-900/30">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden"
      >
        <div className="p-8 sm:p-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Data Deletion Instructions</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">How to request your data removal</p>
            </div>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-slate-600 dark:text-slate-300">
            <section className="bg-amber-50/50 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-100 dark:border-amber-900/20">
              <div className="flex gap-4">
                <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-amber-900 dark:text-amber-400 uppercase tracking-wider mb-2">Our Commitment</h2>
                  <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-500/80">
                    Marketing Operations Portal respects your privacy and provides a straightforward way to delete your data from our systems and disconnect linked third-party services like Facebook.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">How to Request Data Deletion</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                  <p>Send an email to <span className="font-bold text-slate-900 dark:text-white">cbalvarado@sadsadtamesislaw.com</span> with the subject line "Data Deletion Request".</p>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                  <p>Include the email address associated with your account in the body of the message.</p>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                  <p>Our team will process your request within 48-72 hours. You will receive a confirmation email once your data has been permanently removed.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Disconnecting Facebook / Instagram</h2>
              <p className="mb-4">If you wish to specifically remove our application's access to your Facebook or Instagram data, you can do so through your Facebook settings:</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Go to your Facebook Account <span className="font-medium italic">Settings & Privacy</span>.</li>
                <li>Click on <span className="font-medium italic">Settings</span>.</li>
                <li>Look for <span className="font-medium italic">Apps and Websites</span> in the left-hand menu.</li>
                <li>Find <span className="font-bold">Marketing Operations Portal</span> and click <span className="text-red-500 font-bold uppercase tracking-tight">Remove</span>.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">What Data is Deleted?</h2>
              <p>Upon a valid deletion request, we remove:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Your profile information (name, email, avatar).</li>
                <li>Your organizational role and permissions.</li>
                <li>All OAuth tokens used to connect to Facebook/Instagram.</li>
                <li>Any personal metadata associated with your marketing tasks.</li>
              </ul>
            </section>

            <section className="pt-8 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <Mail className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Support Contact</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">cbalvarado@sadsadtamesislaw.com</p>
              </div>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
            <button 
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState(null, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="inline-flex items-center gap-2 text-sm font-medium text-amber-500 hover:text-amber-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Return to Portal
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
