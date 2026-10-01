import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="app-error-page">
      <div className="app-error-card">
        <span className="app-error-icon" aria-hidden="true">
          <SearchX size={24} />
        </span>
        <span className="eyebrow">404 / NOT IN THE WORKSPACE</span>
        <h1>That review could not be found.</h1>
        <p>
          The link may be stale, or this local workspace has not created that
          review yet.
        </p>
        <Link className="button button-dark" href="/workspace">
          <ArrowLeft size={16} />
          Back to workspace
        </Link>
      </div>
    </main>
  );
}
