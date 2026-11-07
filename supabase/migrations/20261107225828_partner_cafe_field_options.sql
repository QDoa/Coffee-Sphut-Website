CREATE FUNCTION public.partner_validate_cafe_selections() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Pending requests already in review retain their original payload.
  IF TG_OP = 'UPDATE' AND OLD.status <> 'draft' THEN
    RETURN NEW;
  END IF;

  IF NEW.payload ? 'rating' THEN
    RAISE EXCEPTION 'Partners cannot propose café rating changes' USING ERRCODE = '22023';
  END IF;

  -- Keep these IDs aligned with the mobile amenity catalog and partner form.
  IF NEW.payload ? 'amenities' AND (
    jsonb_typeof(NEW.payload->'amenities') IS DISTINCT FROM 'array'
    OR NOT (
      (NEW.payload->'amenities') <@
      '["wifi", "sitting_area", "work_station", "delivery_service", "disability_access"]'::jsonb
    )
  ) THEN
    RAISE EXCEPTION 'Choose from the available café amenities' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.partner_validate_cafe_selections() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER partner_cafe_selection_rules
BEFORE INSERT OR UPDATE OF payload ON public.partner_changes
FOR EACH ROW
EXECUTE FUNCTION public.partner_validate_cafe_selections();
