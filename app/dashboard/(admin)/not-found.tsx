import Link from 'next/link';

/**
 * A page inside the dashboard that doesn't exist, or that this person can't see (an estimate on a job
 * they aren't assigned to looks exactly like one that was never there). Shown inside the app frame so
 * there is always a way back.
 */
export default function DashboardNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-3 p-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight">We can't find that page</h1>
      <p className="text-sm text-muted-foreground">It may have been removed, or it may belong to a job or customer you're not assigned to.</p>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link className="underline" href="/dashboard/platform/today">Back to today</Link>
        <Link className="underline" href="/dashboard/platform/estimates">All estimates</Link>
      </div>
    </div>
  );
}
