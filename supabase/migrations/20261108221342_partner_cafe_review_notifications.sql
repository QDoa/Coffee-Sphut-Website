CREATE INDEX partner_review_notifications_submitter
  ON public.partner_changes (submitter, reviewed_at DESC, id)
  WHERE status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL;

-- Use the review itself as the notification so retries cannot create duplicates.
CREATE VIEW public.partner_review_updates WITH (security_invoker = true) AS
SELECT ch.id, ch.cafe_id, ch.payload->>'name' AS name, ch.status, ch.reason, ch.reviewed_at
FROM public.partner_changes ch
WHERE ch.submitter = (SELECT auth.uid())
  AND ch.status IN ('approved', 'rejected') AND ch.reviewed_at IS NOT NULL
  AND public.partner_role(ch.chain_id) IS NOT NULL
  AND (public.partner_can_cafe(ch.cafe_id)
    OR (ch.cafe_id IS NULL AND public.partner_role(ch.chain_id) IN ('owner', 'chain_manager')));

CREATE TABLE public.partner_review_notification_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change_id uuid NOT NULL REFERENCES public.partner_changes(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, change_id)
);
ALTER TABLE public.partner_review_notification_reads ENABLE ROW LEVEL SECURITY;
CREATE INDEX partner_review_notification_reads_change
  ON public.partner_review_notification_reads (change_id);
REVOKE ALL ON public.partner_review_updates, public.partner_review_notification_reads
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.partner_review_updates, public.partner_review_notification_reads TO authenticated;
GRANT INSERT ON public.partner_review_notification_reads TO authenticated;

CREATE POLICY partner_review_receipt_read ON public.partner_review_notification_reads
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.partner_review_updates u WHERE u.id = change_id));

CREATE POLICY partner_review_receipt_insert ON public.partner_review_notification_reads
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.partner_review_updates u WHERE u.id = change_id));

CREATE FUNCTION public.partner_review_notifications(p_page integer)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH updates AS MATERIALIZED (
    SELECT u.*, r.change_id IS NOT NULL AS read
    FROM public.partner_review_updates u
    LEFT JOIN public.partner_review_notification_reads r
      ON r.change_id = u.id AND r.user_id = (SELECT auth.uid())
  ), totals AS (
    SELECT count(*) AS total, count(*) FILTER (WHERE NOT read) AS unread,
      least(greatest(coalesce(p_page, 1), 1), greatest(1, (count(*) + 19) / 20)) AS page
    FROM updates
  )
  SELECT jsonb_build_object('unread', unread, 'total', total, 'page', page, 'updates',
    coalesce((
      SELECT jsonb_agg(page_rows ORDER BY reviewed_at DESC, id)
      FROM (
        SELECT * FROM updates ORDER BY reviewed_at DESC, id
        LIMIT CASE WHEN p_page = 0 THEN 0 ELSE 20 END OFFSET (page - 1) * 20
      ) page_rows
    ), '[]'::jsonb))
  FROM totals;
$$;

CREATE FUNCTION public.partner_mark_review_notification_read(p_change uuid)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  INSERT INTO public.partner_review_notification_reads(user_id, change_id)
  VALUES ((SELECT auth.uid()), p_change)
  ON CONFLICT DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.partner_review_notifications(integer),
  public.partner_mark_review_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_review_notifications(integer),
  public.partner_mark_review_notification_read(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
