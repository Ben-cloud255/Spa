'use client';

import { useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import PasswordInput from '@/components/PasswordInput';

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update your password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-modalBackdropIn">
      <div className="bg-white rounded-xl2 shadow-card w-full max-w-sm p-6 animate-modalContentIn">
        <h2 className="font-display text-2xl mb-1">Change your password</h2>

        {success ? (
          <>
            <p className="text-sm text-forest-600 mt-4 mb-5">
              Your password has been updated. Use your new password next time you sign in.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-forest-600 text-sand-50 py-2.5 text-sm font-medium hover:bg-forest-700"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-forest-500/70 mb-5">
              Only you will know this password — not even the admin can see it once set.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Current password</label>
                <PasswordInput
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">New password</label>
                <PasswordInput
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Confirm new password</label>
                <PasswordInput
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                />
              </div>

              {error && <p className="text-sm text-clay bg-clay/10 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-forest-200 py-2.5 text-sm font-medium hover:bg-forest-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-forest-600 text-sand-50 py-2.5 text-sm font-medium hover:bg-forest-700 disabled:opacity-60"
                >
                  {submitting ? 'Saving…' : 'Update password'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
