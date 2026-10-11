-- Phase 1b: Content & Community tables (Sanity CMS tables + Recipe & Event tables)

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

-- 1. Author
CREATE TABLE IF NOT EXISTS public."Author" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sanity_id text UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  image_url text,
  bio jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "Author_pkey" PRIMARY KEY (id)
);

ALTER TABLE public."Author" OWNER TO postgres;

CREATE OR REPLACE TRIGGER set_author_updated_at
  BEFORE UPDATE ON public."Author"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 2. Category
CREATE TABLE IF NOT EXISTS public."Category" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sanity_id text UNIQUE,
  title text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "Category_pkey" PRIMARY KEY (id)
);

ALTER TABLE public."Category" OWNER TO postgres;

CREATE OR REPLACE TRIGGER set_category_updated_at
  BEFORE UPDATE ON public."Category"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3. Post
CREATE TABLE IF NOT EXISTS public."Post" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sanity_id text UNIQUE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  author_id uuid REFERENCES public."Author"(id) ON UPDATE CASCADE ON DELETE SET NULL,
  main_image_url text,
  summary text,
  body jsonb,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "Post_pkey" PRIMARY KEY (id)
);

ALTER TABLE public."Post" OWNER TO postgres;

CREATE INDEX IF NOT EXISTS post_published_at_idx ON public."Post" (published_at DESC);
CREATE INDEX IF NOT EXISTS post_author_id_idx ON public."Post" (author_id);

CREATE OR REPLACE TRIGGER set_post_updated_at
  BEFORE UPDATE ON public."Post"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. PostCategory (many-to-many join table)
CREATE TABLE IF NOT EXISTS public."PostCategory" (
  post_id uuid NOT NULL REFERENCES public."Post"(id) ON UPDATE CASCADE ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "PostCategory_pkey" PRIMARY KEY (post_id, category_id)
);

ALTER TABLE public."PostCategory" OWNER TO postgres;

CREATE INDEX IF NOT EXISTS post_category_category_id_idx ON public."PostCategory" (category_id);

-- 5. OnboardingQuestion
CREATE TABLE IF NOT EXISTS public."OnboardingQuestion" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sanity_id text UNIQUE,
  question text NOT NULL,
  options text[] NOT NULL DEFAULT '{}'::text[],
  priority integer NOT NULL DEFAULT 0,
  multi_select boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "OnboardingQuestion_pkey" PRIMARY KEY (id)
);

ALTER TABLE public."OnboardingQuestion" OWNER TO postgres;

CREATE INDEX IF NOT EXISTS onboarding_question_active_priority_idx ON public."OnboardingQuestion" (active, priority ASC);

CREATE OR REPLACE TRIGGER set_onboarding_question_updated_at
  BEFORE UPDATE ON public."OnboardingQuestion"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 6. Recipe
CREATE TABLE IF NOT EXISTS public."Recipe" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  image_url text,
  servings integer CHECK (servings IS NULL OR servings > 0),
  prep_time_minutes integer CHECK (prep_time_minutes IS NULL OR prep_time_minutes >= 0),
  cook_time_minutes integer CHECK (cook_time_minutes IS NULL OR cook_time_minutes >= 0),
  difficulty text CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')),
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ingredients) = 'array'),
  instructions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(instructions) = 'array'),
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "Recipe_pkey" PRIMARY KEY (id)
);

ALTER TABLE public."Recipe" OWNER TO postgres;

CREATE INDEX IF NOT EXISTS recipe_published_at_idx ON public."Recipe" (published_at DESC);

CREATE OR REPLACE TRIGGER set_recipe_updated_at
  BEFORE UPDATE ON public."Recipe"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 7. Event
CREATE TABLE IF NOT EXISTS public."Event" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  image_url text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone CHECK (end_time IS NULL OR end_time >= start_time),
  cafe_id bigint REFERENCES public."Cafe"(id) ON UPDATE CASCADE ON DELETE SET NULL,
  address text,
  link text,
  is_featured boolean NOT NULL DEFAULT false,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "Event_pkey" PRIMARY KEY (id)
);

ALTER TABLE public."Event" OWNER TO postgres;

CREATE INDEX IF NOT EXISTS event_start_time_idx ON public."Event" (start_time ASC);
CREATE INDEX IF NOT EXISTS event_published_at_idx ON public."Event" (published_at DESC);
CREATE INDEX IF NOT EXISTS event_cafe_id_idx ON public."Event" (cafe_id);

CREATE OR REPLACE TRIGGER set_event_updated_at
  BEFORE UPDATE ON public."Event"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS on all content tables
ALTER TABLE public."Author" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PostCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OnboardingQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Recipe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Event" ENABLE ROW LEVEL SECURITY;

-- Author policies
CREATE POLICY "Enable read access for all users on Author"
  ON public."Author" FOR SELECT USING (true);
CREATE POLICY "Staff can insert Author"
  ON public."Author" FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update Author"
  ON public."Author" FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Admins can delete Author"
  ON public."Author" FOR DELETE TO authenticated USING (public.is_admin());

-- Category policies
CREATE POLICY "Enable read access for all users on Category"
  ON public."Category" FOR SELECT USING (true);
CREATE POLICY "Staff can insert Category"
  ON public."Category" FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update Category"
  ON public."Category" FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Admins can delete Category"
  ON public."Category" FOR DELETE TO authenticated USING (public.is_admin());

-- Post policies (public sees only published posts; staff sees all including drafts and scheduled)
CREATE POLICY "Public can read published Post and staff can read all"
  ON public."Post" FOR SELECT
  USING ((published_at IS NOT NULL AND published_at <= now()) OR public.is_staff());
CREATE POLICY "Staff can insert Post"
  ON public."Post" FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update Post"
  ON public."Post" FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Admins can delete Post"
  ON public."Post" FOR DELETE TO authenticated USING (public.is_admin());

-- PostCategory policies (join rows can be added/removed by any staff editing a post)
CREATE POLICY "Enable read access for all users on PostCategory"
  ON public."PostCategory" FOR SELECT USING (true);
CREATE POLICY "Staff can insert PostCategory"
  ON public."PostCategory" FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update PostCategory"
  ON public."PostCategory" FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Staff can delete PostCategory"
  ON public."PostCategory" FOR DELETE TO authenticated USING (public.is_staff());

-- OnboardingQuestion policies (public sees active questions; staff sees all)
CREATE POLICY "Public can read active OnboardingQuestion and staff can read all"
  ON public."OnboardingQuestion" FOR SELECT
  USING (active = true OR public.is_staff());
CREATE POLICY "Staff can insert OnboardingQuestion"
  ON public."OnboardingQuestion" FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update OnboardingQuestion"
  ON public."OnboardingQuestion" FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Admins can delete OnboardingQuestion"
  ON public."OnboardingQuestion" FOR DELETE TO authenticated USING (public.is_admin());

-- Recipe policies (public sees published recipes; staff sees all)
CREATE POLICY "Public can read published Recipe and staff can read all"
  ON public."Recipe" FOR SELECT
  USING ((published_at IS NOT NULL AND published_at <= now()) OR public.is_staff());
CREATE POLICY "Staff can insert Recipe"
  ON public."Recipe" FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update Recipe"
  ON public."Recipe" FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Admins can delete Recipe"
  ON public."Recipe" FOR DELETE TO authenticated USING (public.is_admin());

-- Event policies (public sees published events; staff sees all)
CREATE POLICY "Public can read published Event and staff can read all"
  ON public."Event" FOR SELECT
  USING ((published_at IS NOT NULL AND published_at <= now()) OR public.is_staff());
CREATE POLICY "Staff can insert Event"
  ON public."Event" FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update Event"
  ON public."Event" FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Admins can delete Event"
  ON public."Event" FOR DELETE TO authenticated USING (public.is_admin());

GRANT ALL ON FUNCTION public.set_updated_at() TO anon, authenticated, service_role;
GRANT ALL ON TABLE public."Author" TO anon, authenticated, service_role;
GRANT ALL ON TABLE public."Category" TO anon, authenticated, service_role;
GRANT ALL ON TABLE public."Post" TO anon, authenticated, service_role;
GRANT ALL ON TABLE public."PostCategory" TO anon, authenticated, service_role;
GRANT ALL ON TABLE public."OnboardingQuestion" TO anon, authenticated, service_role;
GRANT ALL ON TABLE public."Recipe" TO anon, authenticated, service_role;
GRANT ALL ON TABLE public."Event" TO anon, authenticated, service_role;
