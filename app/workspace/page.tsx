"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Plus,
  Search,
  GitBranch,
  ShieldCheck,
  Layers3,
  Clock3,
} from "lucide-react";
import {
  Shell,
  PageHeading,
  Badge,
  Loading,
  ErrorBox,
  Empty,
} from "@/components/ui";
import type { Review } from "@/lib/types";
import { patchEvidence } from "@/components/review-state";
export default function Workspace() {
  const [reviews, setReviews] = useState<Review[] | null>(null),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState("");
  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => {
        if (!r.ok) throw new Error("Unable to load reviews. Refresh to retry.");
        return r.json();
      })
      .then(setReviews)
      .catch((e) => setError(e.message));
  }, []);
  const fixed = (r: Review) => patchEvidence(r).verified;
  const visible = reviews?.filter(
    (r) =>
      r.title.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "risk" && r.analysis.newRoute && !fixed(r)) ||
        (filter === "verified" && fixed(r))),
  );
  return (
    <Shell>
      <div className="page-content">
        <PageHeading
          eyebrow="YOUR REVIEW DESK"
          title="A clear view of every change."
          description="Inspect skill updates before they become someone else’s incident."
          action={
            <Link href="/create" className="button button-dark">
              <Plus size={17} />
              Create review
            </Link>
          }
        />
        <div className="stats-row">
          <div>
            <span>
              <Layers3 size={17} /> Skill sets
            </span>
            <strong>{reviews?.length ?? "—"}</strong>
            <small>Report & publishing workflows</small>
          </div>
          <div>
            <span>
              <GitBranch size={17} /> Proposed updates
            </span>
            <strong>{reviews?.filter((r) => !fixed(r)).length ?? "—"}</strong>
            <small>Ready for investigation</small>
          </div>
          <div>
            <span>
              <ShieldCheck size={17} /> Verified repairs
            </span>
            <strong>{reviews?.filter(fixed).length ?? "—"}</strong>
            <small>Blocked probe + successful task</small>
          </div>
        </div>
        <Link href="/review/demo" className="demo-banner">
          <div className="demo-banner-icon">
            <GitBranch size={29} />
          </div>
          <div>
            <span className="eyebrow">START WITH A WORKING EXAMPLE</span>
            <h2>The report that took a wrong turn.</h2>
            <p>
              Follow a private document from a one-line skill update to a public
              page. Then close the route.
            </p>
          </div>
          <span className="button button-light">
            Run the demo <ArrowUpRight size={17} />
          </span>
        </Link>
        <section className="reviews-section">
          <div className="section-heading">
            <h2>
              Update reviews{" "}
              <span className="count-label">{reviews?.length ?? 0}</span>
            </h2>
            <label className="search-field">
              <Search size={16} />
              <input
                aria-label="Search reviews"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a review…"
              />
            </label>
          </div>
          <div className="filter-row">
            {[
              ["all", "All reviews"],
              ["risk", "Needs investigation"],
              ["verified", "Verified repairs"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? "selected" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {error ? (
            <ErrorBox message={error} />
          ) : !reviews ? (
            <Loading />
          ) : visible?.length ? (
            <div className="review-list">
              {visible.map((r) => (
                <Link
                  className="review-row"
                  href={`/review/${r.id}`}
                  key={r.id}
                >
                  <span className="review-glyph">
                    <GitBranch size={21} />
                  </span>
                  <div className="review-row-title">
                    <strong>{r.title}</strong>
                    <span>
                      {r.skills[1].name}{" "}
                      <span className="mono">
                        {r.skills[0].version} → {r.skills[1].version}
                      </span>
                    </span>
                  </div>
                  <Badge
                    tone={
                      fixed(r)
                        ? "green"
                        : r.analysis.newRoute
                          ? "amber"
                          : "neutral"
                    }
                  >
                    {fixed(r)
                      ? "Repair verified"
                      : r.analysis.newRoute
                        ? "New route found"
                        : "Needs manual review"}
                  </Badge>
                  <span className="review-date">
                    <Clock3 size={13} />
                    {new Date(r.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <ArrowUpRight size={18} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty>
              No reviews match this view. Change the filter or create a review.
            </Empty>
          )}
        </section>
        <div className="workspace-bottom">
          <span className="small-caps">A NOTE ON VERDICTS</span>
          <p>
            A verified repair means the selected simulated attack was blocked
            and the normal task succeeded. It is evidence for this path, not a
            blanket safety certificate.
          </p>
        </div>
      </div>
    </Shell>
  );
}
