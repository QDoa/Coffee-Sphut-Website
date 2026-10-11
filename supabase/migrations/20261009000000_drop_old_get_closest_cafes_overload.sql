-- Clean up old 4-argument get_closest_cafes overload if it exists
-- The active version has 6 arguments (with has_reward and amenity_ids)
DROP FUNCTION IF EXISTS public.get_closest_cafes(double precision, double precision, text, integer);
