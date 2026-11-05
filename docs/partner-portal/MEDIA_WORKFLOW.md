# Partner managed images: operation and recovery

Implemented November 5, 2026. The rollout release flag, normal Auth, staff checks and database RLS remain required outside the isolated local preview.

## Upload and review

1. Open a café edit/new request. Existing image URL controls retain their behavior. Upload a cover or gallery image in **Upload café images**. JPEG, PNG and WebP are accepted, up to 5 MB each. A selected uploaded cover replaces the cover URL; uploaded gallery images follow existing gallery URLs in order. Remove a selection before submitting if it is no longer wanted.
2. Wait for each upload to finish, then save the draft or submit for review. Uploads alone never change the public listing. Draft links now show the proposed café name. Rejected requests can reuse their still-authorized staged assets in a new submission.
3. An independent Coffee Sphut editor/admin inspects all proposed fields and image previews, then approves or rejects the whole request. Partners cannot replace staged bytes after upload. Fresh membership, assignments, restrictions, café revisions and Free slots remain authoritative.

Private previews use `/partner/media/[id]` with current authenticated access on every request and `Cache-Control: private, no-store`. Avoid replacing this with the public image optimizer or long-lived signed links: signed Storage links survive authorization revocation until expiry.

## Publication recovery

Approval first persists `partner_media_publications` with the reviewer and exact request/asset manifest, and an audit event. Only then does the authenticated staff session download private bytes and upload immutable deterministic public paths under `media/cafes/partner/`. The final database command checks that every destination exists and that the reviewed request is still current; café/menu/gallery references change together.

- **Copy/network failure:** the listing remains unchanged and the request stays pending. Retry **Approve request**. Matching destinations from the earlier attempt are reused, never overwritten. A mismatched destination blocks approval for investigation.
- **Newer café edit or plan restriction:** final approval fails. Refresh, reject the stale request with a reason, and ask the partner to resubmit against current information. Files already copied under recorded approval intent may remain public until explicitly cleaned up; they are not attached to the café automatically.
- **Lost success response:** retrying the same request returns its receipt after current authorization is rechecked. It does not duplicate gallery entries or copies.
- **Reviewer revoked/self-review:** preparation/final publication is denied. Another currently authorized independent staff reviewer must handle the pending request.

Publication is initiated and retried from the staff action. This implementation does not run a background job scheduler.

## Cleanup and retention

Admins use **Upload cleanup** in staff reviews. The table shows the latest 100 metadata records, including failed/deleted receipts. Copy an upload ID into **Upload ID** and choose **Remove unused upload**. Known older IDs can also be submitted. Editors and partners cannot delete objects.

Cleanup checks draft/pending selections and URL references, then live cover/gallery references. Registered objects are protected from the legacy café-image cleaner until explicitly claimed. URL checks decode once, include query/encoding aliases, and retain shared references. Claims and fresh managed selections/URL references serialize through database locks. A claimed asset cannot be reattached by a later partner save.

Physical removal always goes through authenticated `storage.from(bucket).remove(paths)`, preserving admin-only deletion. Neither object rows nor buckets are deleted with SQL. Only the generated private path and this project's `media/cafes/partner/` destination are cleanup targets. External image URLs are detached, never physically deleted.

Failures retain the claim, path metadata and error for retry. Retry the same upload ID after resolving the error. A file still referenced by any authorized draft/pending/live record is retained. Metadata and audit receipts are not purged. No automatic rejected/abandoned-file retention period has been chosen; agree that policy and operator ownership before adding scheduled deletion.

## Local verification

```sh
pnpm partner:local
pnpm partner:preview
# In another terminal, with the preview running:
pnpm partner:test:media
pnpm partner:test:browser
```

The isolated Storage API is `coffee-partner-storage` v1.80.2 on loopback port 55435; the preview proxy routes `/storage/v1` to it. Test users/JWTs and data are synthetic. The stack script validates fixture container bindings and retains existing data. It upgrades only an empty fixture Storage shim to the real service schema, and refuses a nonempty shim. SQL-only migration replay retains its minimal shim; media tests require the real service, not that replay database.

The media integration tests use a dedicated synthetic café 90101; do not expect the interactive preview database to retain pristine seed counts. Run core database regressions against a fresh `partner_replay` with `PARTNER_TEST_REPLAY=1` after initializing it. Tests never accept arbitrary hosted database URLs.

## Hosted acceptance still required

Apply both additive partner migrations to the explicitly verified staging project, check grants/policies/advisors, and test with real Owner, assigned Café Manager, independent editor and admin sessions. Verify upload body limits, supported images, revocation, copy failure/retry, shared/draft reference protection, and missing-object cleanup against that service version. Verify backups include Storage bytes as well as Postgres metadata. Agree retention, quotas, operational ownership and realistic-volume targets before general launch. No hosted project or Auth setting was changed by this implementation.
