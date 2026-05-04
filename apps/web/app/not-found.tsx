import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-7xl font-black text-slate-600 mb-4">404</p>
        <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
        <p className="text-slate-400 mb-8">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center h-12 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
