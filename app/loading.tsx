export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>Loading ChainPatch…</span>
    </div>
  );
}
