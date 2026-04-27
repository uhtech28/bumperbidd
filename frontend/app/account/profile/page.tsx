'use client';

/**
 * /account/profile - self-service profile editor.
 *
 * Editable: displayName, bio, profilePhotoUrl.
 * Read-only: phone, email, role, member-since, verification badges.
 *
 * Photo upload reuses the existing presigned-PUT flow. We treat the
 * upload as best-effort - if S3/MinIO is unconfigured the user just
 * doesn't get a photo, the rest of the form still saves.
 */
import { useEffect, useState } from 'react';
import {
  usersApi,
  uploadsApi,
  ApiError,
  type UserProfile,
} from '@/lib/api';
import { UserShell } from '@/components/shell/UserShell';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .me()
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setDisplayName(p.displayName ?? '');
        setBio(p.bio ?? '');
        setPhotoUrl(p.profilePhotoUrl);
      })
      .catch((e: ApiError) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  async function uploadPhoto(file: File) {
    setError(null);
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setError('Photo must be PNG, JPEG, or WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5MB.');
      return;
    }
    setPhotoUploading(true);
    try {
      const p = await uploadsApi.presign(file.type, file.size, 'kyc_doc');
      const put = await fetch(p.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error('Upload failed.');
      await uploadsApi.confirm(p.key, file.type, file.size);
      setPhotoUrl(p.publicUrl);
      setSuccess('Photo uploaded - click Save to keep the change.');
    } catch (err) {
      setError(
        (err as Error).message +
          ' (Photo upload requires S3/MinIO to be configured. The rest of your profile will still save.)',
      );
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const next = await usersApi.update({
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        profilePhotoUrl: photoUrl,
      });
      setProfile(next);
      setSuccess('Profile saved.');
    } catch (err) {
      setError((err as ApiError).message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <UserShell>
      <div className="mx-auto max-w-2xl px-6 py-8 pb-24 md:px-8">
        <header className="mb-6">
          <p className="text-[12px] uppercase tracking-[0.22em] text-bone/45">
            Account
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-bone">
            Profile
          </h1>
          <p className="mt-1 text-[13px] text-bone/55">
            Bidders see your name and bio on auctions you list. Phone and email
            are private.
          </p>
        </header>

        {!profile ? (
          <div className="rounded-xl border border-white/8 bg-graphite/40 p-8 text-center text-bone/60">
            Loading…
          </div>
        ) : (
          <form
            onSubmit={handleSave}
            className="space-y-5 rounded-xl border border-white/8 bg-graphite/50 p-6"
          >
            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[20px] font-semibold text-brand-300">
                    {(displayName || profile.email || profile.phone || '?')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-bone/55">
                  Profile photo
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={photoUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadPhoto(f);
                  }}
                  className="mt-1 text-[12px] text-bone/70"
                />
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl(null)}
                    className="ml-3 text-[11px] text-bone/55 hover:text-red-300"
                  >
                    Remove
                  </button>
                )}
                <p className="mt-1 text-[11px] text-bone/45">
                  PNG / JPEG / WebP, under 5MB.
                </p>
              </div>
            </div>

            {/* Display name */}
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-bone/55">
                Display name
              </span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="What buyers and sellers see"
                maxLength={80}
                className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-[14px] text-bone placeholder-bone/35 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
              <span className="mt-1 block text-[11px] text-bone/45">
                {displayName.length}/80
              </span>
            </label>

            {/* Bio */}
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-bone/55">
                Bio
              </span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Optional. Surfaced on auctions you list."
                maxLength={500}
                rows={4}
                className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-[14px] text-bone placeholder-bone/35 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
              <span className="mt-1 block text-[11px] text-bone/45">
                {bio.length}/500
              </span>
            </label>

            {/* Read-only identity */}
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-4 sm:grid-cols-2">
              <ReadOnly label="Email" value={profile.email ?? '\u2014'} verified={profile.emailVerified} />
              <ReadOnly label="Phone" value={profile.phone ?? '\u2014'} verified={profile.phoneVerified} />
              <ReadOnly label="Role" value={profile.role} />
              <ReadOnly
                label="Member since"
                value={new Date(profile.createdAt).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                {success}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || photoUploading}
                className="rounded-lg bg-brand-500 px-5 py-2 text-[13px] font-semibold text-ink hover:bg-brand-400 disabled:opacity-60"
              >
                {saving ? 'Saving\u2026' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </UserShell>
  );
}

function ReadOnly({
  label,
  value,
  verified,
}: {
  label: string;
  value: string;
  verified?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-bone/45">{label}</p>
      <p className="mt-0.5 flex items-center gap-2 text-[13px] text-bone/85">
        <span className="truncate">{value}</span>
        {verified !== undefined && value !== '\u2014' && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
              verified
                ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
            }`}
          >
            {verified ? 'Verified' : 'Unverified'}
          </span>
        )}
      </p>
    </div>
  );
}
