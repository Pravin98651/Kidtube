import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto space-y-8 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <header className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">KidTube Privacy Policy (COPPA)</h1>
          <Link href="/" className="text-sm font-medium hover:underline">
            &larr; Back to Dashboard
          </Link>
        </header>

        <section className="space-y-4 text-gray-700 dark:text-gray-300">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">1. Information We Collect</h2>
          <p>
            KidTube is built for parents. We only collect the necessary information required to provide video curation and screen time tracking features. We collect email addresses from parents for account creation, and viewing history to provide reports to parents.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">2. COPPA Compliance</h2>
          <p>
            We strictly adhere to the Children&apos;s Online Privacy Protection Act (COPPA). We do not require children to disclose any personal information to use the KidTube app. All accounts are managed exclusively by the parent or legal guardian.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">3. Data Deletion</h2>
          <p>
            Parents have the right to review, delete, and prevent further collection of their child&apos;s information. To completely delete your account and all associated data, you may use the Data Deletion request form in your Dashboard, or contact our support team.
          </p>

          <div className="mt-8 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800">
            <p className="font-semibold mb-2">Request Data Deletion</p>
            <p className="text-sm mb-4">Clicking the button below will permanently wipe your account, your child&apos;s profiles, and all watch history from our servers.</p>
            <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">
              Delete All Data
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
