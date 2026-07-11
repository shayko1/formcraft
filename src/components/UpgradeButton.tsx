import { useState } from "react";

interface UpgradeButtonProps {
  label?: string;
  className?: string;
}

// Starts the Wix-hosted Pro checkout. On 401 (not logged in) it routes through login first.
export default function UpgradeButton({
  label = "Upgrade to Pro",
  className = "rounded-xl bg-grad-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60",
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/upgrade", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401 && body.loginUrl) {
        window.location.href = body.loginUrl;
        return;
      }
      if (res.ok && body.url) {
        window.location.href = body.url;
        return;
      }
      setError(body.message ?? "Could not start checkout. Please try again.");
      setLoading(false);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-stretch gap-1">
      <button onClick={upgrade} disabled={loading} className={className}>
        {loading ? "Starting checkout…" : label}
      </button>
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </span>
  );
}
