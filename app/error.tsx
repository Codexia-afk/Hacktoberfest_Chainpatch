'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the boundary observable in development without exposing details in
    // the UI or sending data to a third party.
    console.error(error);
  }, [error]);

  return (
    <main className="app-error-page">
      <div className="app-error-card">
        <span className="app-error-icon warning" aria-hidden="true">
          <AlertTriangle size={24} />
        </span>
        <span className="eyebrow">RECOVERABLE WORKSPACE ERROR</span>
        <h1>The workflow hit an unexpected stop.</h1>
        <p>
          Your saved reviews are unchanged. Retry the view, or return to the
          workspace and continue from the last verified step.
        </p>
        <div className="app-error-actions">
          <button className="button button-dark" onClick={() => reset()}>
            <RotateCcw size={16} />
            Try again
          </button>
          <Link className="button" href="/workspace">
            <ArrowLeft size={16} />
            Workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
