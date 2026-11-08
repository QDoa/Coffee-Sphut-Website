-- Keep all command entry points behind the confirmation check.
ALTER FUNCTION public.partner_command(text, jsonb) SET SCHEMA partner_internal;
REVOKE ALL ON FUNCTION partner_internal.partner_command(text, jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION partner_internal.confirmed_partner_command(p_action text, p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated request required' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'activate_plan' AND p_input->>'plan' = 'free'
    AND coalesce(p_input->'cafe_ids', '[]'::jsonb) = '[]'::jsonb
    AND p_input->'confirm_empty_free' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Choose cafés or confirm that this Free plan keeps no café access.';
  END IF;

  RETURN partner_internal.partner_command(p_action, p_input);
END;
$$;

CREATE FUNCTION public.partner_command(p_action text, p_input jsonb)
RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT partner_internal.confirmed_partner_command(p_action, p_input);
$$;

CREATE FUNCTION public.partner_plan_cafes(p_chain uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'address', c.address, 'active', c.is_active
  ) ORDER BY c.name, c.id), '[]'::jsonb)
  FROM public."Cafe" c
  JOIN public.partner_accounts a ON a.chain_id = c.chain_id
  WHERE c.chain_id = p_chain AND c.is_active IS NOT NULL AND public.is_admin();
$$;

REVOKE ALL ON FUNCTION partner_internal.confirmed_partner_command(text, jsonb),
  public.partner_command(text, jsonb), public.partner_plan_cafes(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION partner_internal.confirmed_partner_command(text, jsonb),
  public.partner_command(text, jsonb), public.partner_plan_cafes(uuid)
  TO authenticated;

-- Apply eligibility to the candidates before nearest-neighbor ordering and LIMIT.
-- Keep the existing v2 fields and leave the legacy discovery function intact.
CREATE OR REPLACE FUNCTION public.get_closest_cafes_v2(
  user_lat double precision, user_long double precision,
  search_term text DEFAULT '', max_results integer DEFAULT 100,
  has_reward boolean DEFAULT false, amenity_ids text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH input AS (
    SELECT extensions.st_point(user_long, user_lat)::extensions.geography AS origin,
      to_tsquery('english', nullif(array_to_string(
        ARRAY(
          SELECT lexeme || ':*'
          FROM unnest(regexp_split_to_array(
            regexp_replace(btrim(search_term), '[^[:alnum:]]+', ' ', 'g'), ' '
          )) AS lexeme
          WHERE lexeme <> ''
        ), ' & '
      ), '')) AS terms
  )
  SELECT coalesce(jsonb_agg(candidate ORDER BY candidate.distance_meters, candidate.id), '[]'::jsonb)
  FROM (
    SELECT c.id, c.name, c.address, c.image_url, c.description, c.phone_number,
      c.email, c.social_media, c.amenities, c.rating, c.time_open, c.link, c.show_details,
      extensions.st_y(c.location::extensions.geometry) AS latitude,
      extensions.st_x(c.location::extensions.geometry) AS longitude,
      extensions.st_distance(c.location, input.origin) AS distance_meters,
      gallery.images_url,
      (c.reward_code IS NOT NULL AND c.reward_code <> '') AS has_reward
    FROM public."Cafe" c
    LEFT JOIN public."CafeImages" gallery ON gallery.cafe_id = c.id
    CROSS JOIN input
    WHERE c.is_active IS TRUE
      AND (coalesce(btrim(search_term), '') = '' OR c.fts_vectors @@ input.terms)
      AND (NOT has_reward OR (c.reward_code IS NOT NULL AND c.reward_code <> ''))
      AND (amenity_ids = '{}' OR c.amenities @> amenity_ids)
    ORDER BY c.location OPERATOR(extensions.<->) input.origin
    LIMIT least(greatest(max_results, 1), 200)
  ) AS candidate;
$$;

NOTIFY pgrst, 'reload schema';
