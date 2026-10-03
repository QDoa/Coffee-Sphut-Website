-- Fixes "42601 syntax error in tsquery" raised by get_closest_cafes.
--
-- The raw search term was interpolated straight into to_tsquery(), so any
-- token containing a tsquery operator (&, |, !, (, ), :) -- or a
-- whitespace-only term -- produced an invalid query and raised an error.
-- Tokens are now reduced to alphanumerics and ANDed together as prefix
-- matches (:*), preserving existing prefix behaviour ('cof' -> "Coffee").
--
-- Reachable from real data: Cafe.name contains "Top Beans. Coffee & More"
-- and Cafe.address contains "Int'l Airport Rd".

CREATE OR REPLACE FUNCTION public.get_closest_cafes(
  user_lat double precision,
  user_long double precision,
  search_term text DEFAULT '',
  max_results integer DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  name text,
  address text,
  image_url text,
  description text,
  phone_number text,
  email text,
  social_media jsonb,
  amenities text[],
  rating real,
  time_open jsonb,
  link text,
  show_details boolean,
  reward_code text,
  latitude double precision,
  longitude double precision,
  distance_meters double precision,
  images_url text[]
)
LANGUAGE sql
AS $$
  select
    c.id,
    c.name,
    c.address,
    c.image_url,
    c.description,
    c.phone_number,
    c.email,
    c.social_media,
    c.amenities,
    c.rating,
    c.time_open,
    c.link,
    c.show_details,
    c.reward_code,
    st_y(c.location::geometry) as latitude,
    st_x(c.location::geometry) as longitude,
    st_distance(c.location, st_point(user_long, user_lat)::geography) as distance_meters,
    ci.images_url
  from "Cafe" c
  left join "CafeImages" ci on c.id = ci.cafe_id
  where coalesce(btrim(search_term), '') = ''
     or c.fts_vectors @@ to_tsquery(
          'english',
          array_to_string(
            array(
              select lexeme || ':*'
              from unnest(
                regexp_split_to_array(
                  regexp_replace(btrim(search_term), '[^[:alnum:]]+', ' ', 'g'),
                  ' '
                )
              ) as lexeme
              where lexeme <> ''
            ),
            ' & '
          )
        )
  order by c.location <-> st_point(user_long, user_lat)::geography
  limit max_results;
$$;