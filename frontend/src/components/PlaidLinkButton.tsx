import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export default function PlaidLinkButton({ onSuccess, onError }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reportError(msg: string) {
    onError?.(msg);
  }

  async function fetchLinkToken() {
    setBusy(true);
    try {
      const res = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create link token');
      setLinkToken(data.link_token);
      setBusy(false);
    } catch (err) {
      reportError(err instanceof Error ? err.message : 'Failed to initialize Plaid');
      setBusy(false);
    }
  }

  const onPlaidSuccess = useCallback(
    async (publicToken: string, metadata: { institution: { name: string; institution_id: string } | null }) => {
      setBusy(true);
      try {
        const res = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            public_token: publicToken,
            institution: metadata.institution,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to link account');
        }
        setLinkToken(null);
        onSuccess?.();
      } catch (err) {
        reportError(err instanceof Error ? err.message : 'Failed to link account');
      } finally {
        setBusy(false);
      }
    },
    [onSuccess, onError],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: () => setLinkToken(null),
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  return (
    <button
      onClick={fetchLinkToken}
      disabled={busy}
      className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
    >
      {busy ? 'Connecting...' : 'Link Account'}
    </button>
  );
}
