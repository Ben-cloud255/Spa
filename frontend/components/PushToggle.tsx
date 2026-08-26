'use client';

import { useEffect, useState } from 'react';
import { enablePushNotifications, disablePushNotifications, getPushSubscriptionState } from '@/lib/push';

export default function PushToggle() {
  const [state, setState] = useState<'loading' | 'subscribed' | 'unsubscribed' | 'unsupported'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushSubscriptionState().then(setState);
  }, []);

  async function handleToggle() {
    setBusy(true);
    setError(null);
    try {
      if (state === 'subscribed') {
        await disablePushNotifications();
        setState('unsubscribed');
      } else {
        await enablePushNotifications();
        setState('subscribed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update phone alerts.');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return null;

  return (
    <div className="mt-3">
      {state === 'unsupported' ? (
        <p className="text-[11px] text-forest-300 leading-snug">
          Phone alerts aren't available here. On iPhone: Share → Add to Home Screen, then open it from there.
        </p>
      ) : (
        <button
          onClick={handleToggle}
          disabled={busy}
          className="text-xs text-forest-200 hover:text-white underline underline-offset-2 disabled:opacity-50"
        >
          {busy ? 'Updating…' : state === 'subscribed' ? 'Phone alerts on — turn off' : 'Turn on phone alerts'}
        </button>
      )}
      {error && <p className="text-[11px] text-clay mt-1 leading-snug">{error}</p>}
    </div>
  );
}
