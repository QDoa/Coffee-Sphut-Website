-- Baseline schema for Coffee Sphut database
CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';







CREATE OR REPLACE FUNCTION "public"."handle_new_transaction_chain"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_chain_id   uuid;
  v_threshold  integer;
  v_card       public."UserChainLoyalty"%rowtype;
begin
  select
    s.chain_id,
    coalesce(s.loyalty_threshold_override, c.loyalty_threshold) as effective_threshold
  into v_chain_id, v_threshold
  from public."Cafe" s
  join public."Chains" c on c.id = s.chain_id
  where s.id = new.store_id;

  if v_chain_id is null then
    -- no chain/loyalty configured; do nothing
    return new;
  end if;

  -- lock or create the user's chain-level loyalty row
  select *
  into v_card
  from public."UserChainLoyalty"
  where user_id = new.user_id
    and chain_id = v_chain_id
  for update;

  if not found then
    insert into public."UserChainLoyalty" (user_id, chain_id, punch_count, reward_count)
    values (new.user_id, v_chain_id, 0, 0)
    returning * into v_card;
  end if;

  -- increment punches
  v_card.punch_count := v_card.punch_count + 1;

  if v_card.punch_count >= v_threshold then
    -- hit threshold: reset punches and increment rewards
    v_card.punch_count   := 0;
    v_card.reward_count  := v_card.reward_count + 1;
    v_card.last_reset_at := now();

    insert into public."Rewards" (user_id, chain_id, earned_store, status)
    values (new.user_id, v_chain_id, new.store_id, 'issued');
  end if;

  update public."UserChainLoyalty"
  set punch_count   = v_card.punch_count,
      reward_count  = v_card.reward_count,
      last_reset_at = v_card.last_reset_at,
      updated_at    = now()
  where id = v_card.id;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_transaction_chain"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_reward_redeemed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$BEGIN
  -- Only act when status changes from 'issued' to 'redeemed'
  RAISE NOTICE  'User id is: %', NEW.user_id;    -- prints to console/logs
  RAISE NOTICE  'Chain id is: %', NEW.chain_id;    -- prints to console/logs

  IF OLD.status = 'issued' AND NEW.status = 'redeemed' THEN
    UPDATE "UserChainLoyalty"
    SET reward_count = reward_count - 1
    WHERE user_id = NEW.user_id
      AND chain_id = NEW.chain_id;

    -- Optional: raise an error if no matching row was found
    IF NOT FOUND THEN
      RAISE WARNING 'No UserChainLoyalty row found for user_id=% and chain_id=%',
        NEW.user_id, NEW.chain_id;
    END IF;
  END IF;

  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."handle_reward_redeemed"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."Bookmark" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "post_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."Bookmark" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Cafe" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "image_url" "text",
    "address" "text",
    "time_open" json,
    "longitude" double precision,
    "latitude" double precision,
    "link" "text",
    "description" "text",
    "phone_number" "text",
    "email" "text",
    "social_media" "jsonb",
    "amenities" "text"[],
    "rating" real,
    "is_active" boolean DEFAULT true,
    "chain_id" "uuid" NOT NULL,
    "loyalty_threshold_override" integer,
    "reward_code" "text",
    "show_details" boolean DEFAULT false,
    "location" "extensions"."geography"(Point,4326),
    "fts_vectors" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"english"'::"regconfig", ((((COALESCE("name", ''::"text") || ' '::"text") || COALESCE("description", ''::"text")) || ' '::"text") || COALESCE("address", ''::"text")))) STORED,
    "postcode" "text"
);


ALTER TABLE "public"."Cafe" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Cafe"."phone_number" IS 'phone number of cafe';



COMMENT ON COLUMN "public"."Cafe"."email" IS 'cafe email';



COMMENT ON COLUMN "public"."Cafe"."social_media" IS 'Cafes social media';



COMMENT ON COLUMN "public"."Cafe"."amenities" IS 'List of amenities';



COMMENT ON COLUMN "public"."Cafe"."show_details" IS 'Flag to determine if the mobile app should show details';



COMMENT ON COLUMN "public"."Cafe"."postcode" IS 'Postal Code';



CREATE TABLE IF NOT EXISTS "public"."CafeImages" (
    "cafe_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "images_url" "text"[]
);


ALTER TABLE "public"."CafeImages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."CafeMenu" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cafe_id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" bigint NOT NULL,
    "currency" character varying NOT NULL
);


ALTER TABLE "public"."CafeMenu" OWNER TO "postgres";


COMMENT ON TABLE "public"."CafeMenu" IS 'Menu of cafe';



ALTER TABLE "public"."Cafe" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."Cafe_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."Chains" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "loyalty_threshold" integer DEFAULT 10 NOT NULL
);


ALTER TABLE "public"."Chains" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Profile" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "onboarding_responses" "jsonb",
    "onboarding_completed" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."Profile" OWNER TO "postgres";


COMMENT ON TABLE "public"."Profile" IS 'User profile separate from auth to store more user specific data';



COMMENT ON COLUMN "public"."Profile"."onboarding_completed" IS 'Has user completed onboarding';



CREATE TABLE IF NOT EXISTS "public"."RewardTransaction" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "store_id" bigint NOT NULL
);


ALTER TABLE "public"."RewardTransaction" OWNER TO "postgres";


COMMENT ON TABLE "public"."RewardTransaction" IS 'Track reward transactions';



CREATE TABLE IF NOT EXISTS "public"."Rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "chain_id" "uuid" NOT NULL,
    "earned_store" bigint NOT NULL,
    "status" "text" DEFAULT 'issued'::"text" NOT NULL,
    "redeemed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."Rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SavedCafe" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "cafe_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."SavedCafe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."UserChainLoyalty" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "chain_id" "uuid" NOT NULL,
    "punch_count" bigint,
    "reward_count" bigint,
    "last_reset_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."UserChainLoyalty" OWNER TO "postgres";


COMMENT ON TABLE "public"."UserChainLoyalty" IS 'Track users loayalty';



CREATE TABLE IF NOT EXISTS "public"."Waitlist" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text" NOT NULL,
    "resend_id" "uuid" NOT NULL
);


ALTER TABLE "public"."Waitlist" OWNER TO "postgres";


COMMENT ON TABLE "public"."Waitlist" IS 'Waitlist for coffee sphut';



ALTER TABLE "public"."Waitlist" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."Waitlist_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."Bookmark"
    ADD CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("user_id", "post_id");



ALTER TABLE ONLY "public"."CafeImages"
    ADD CONSTRAINT "CafeImages_cafe_id_key" UNIQUE ("cafe_id");



ALTER TABLE ONLY "public"."CafeImages"
    ADD CONSTRAINT "CafeImages_pkey" PRIMARY KEY ("cafe_id");



ALTER TABLE ONLY "public"."CafeMenu"
    ADD CONSTRAINT "CafeMenu_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Cafe"
    ADD CONSTRAINT "Cafe_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."Cafe"
    ADD CONSTRAINT "Cafe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Chains"
    ADD CONSTRAINT "Chains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Profile"
    ADD CONSTRAINT "Profile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."RewardTransaction"
    ADD CONSTRAINT "RewardTransaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Rewards"
    ADD CONSTRAINT "Rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SavedCafe"
    ADD CONSTRAINT "SavedCafe_pkey" PRIMARY KEY ("user_id", "cafe_id");



ALTER TABLE ONLY "public"."UserChainLoyalty"
    ADD CONSTRAINT "UserChainLoyalty_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Waitlist"
    ADD CONSTRAINT "Waitlist_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."Waitlist"
    ADD CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Waitlist"
    ADD CONSTRAINT "Waitlist_resend_id_key" UNIQUE ("resend_id");



CREATE INDEX "cafe_fts_idx" ON "public"."Cafe" USING "gin" ("fts_vectors");



CREATE INDEX "cafes_geo_idx" ON "public"."Cafe" USING "gist" ("location");



CREATE OR REPLACE TRIGGER "on_reward_redemeed" AFTER UPDATE ON "public"."Rewards" FOR EACH ROW EXECUTE FUNCTION "public"."handle_reward_redeemed"();



CREATE OR REPLACE TRIGGER "on_reward_transaction_created_chain" AFTER INSERT ON "public"."RewardTransaction" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_transaction_chain"();



ALTER TABLE ONLY "public"."Bookmark"
    ADD CONSTRAINT "Bookmark_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."CafeImages"
    ADD CONSTRAINT "CafeImages_cafe_id_fkey" FOREIGN KEY ("cafe_id") REFERENCES "public"."Cafe"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."CafeMenu"
    ADD CONSTRAINT "CafeMenu_cafe_id_fkey" FOREIGN KEY ("cafe_id") REFERENCES "public"."Cafe"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Cafe"
    ADD CONSTRAINT "Cafe_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "public"."Chains"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."Profile"
    ADD CONSTRAINT "Profile_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."RewardTransaction"
    ADD CONSTRAINT "RewardTransaction_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."Cafe"("id");



ALTER TABLE ONLY "public"."RewardTransaction"
    ADD CONSTRAINT "RewardTransaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."Rewards"
    ADD CONSTRAINT "Rewards_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "public"."Chains"("id");



ALTER TABLE ONLY "public"."Rewards"
    ADD CONSTRAINT "Rewards_earned_store_fkey" FOREIGN KEY ("earned_store") REFERENCES "public"."Cafe"("id");



ALTER TABLE ONLY "public"."Rewards"
    ADD CONSTRAINT "Rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."SavedCafe"
    ADD CONSTRAINT "SavedCafe_cafe_id_fkey" FOREIGN KEY ("cafe_id") REFERENCES "public"."Cafe"("id");



ALTER TABLE ONLY "public"."SavedCafe"
    ADD CONSTRAINT "SavedCafe_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."UserChainLoyalty"
    ADD CONSTRAINT "UserChainLoyalty_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "public"."Chains"("id");



ALTER TABLE ONLY "public"."UserChainLoyalty"
    ADD CONSTRAINT "UserChainLoyalty_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Allow individual delete access" ON "public"."Bookmark" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Allow individual insert access" ON "public"."Bookmark" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Allow individual read access" ON "public"."Bookmark" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."Bookmark" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Cafe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."CafeImages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."CafeMenu" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Chains" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Enable delete for users based on user_id" ON "public"."SavedCafe" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable insert" ON "public"."Waitlist" FOR INSERT TO "anon", "service_role" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."Profile" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for users based on user_id" ON "public"."Profile" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Enable insert for users based on user_id" ON "public"."RewardTransaction" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for users based on user_id" ON "public"."SavedCafe" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable read access for all users" ON "public"."Cafe" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."CafeImages" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."Chains" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."Rewards" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."UserChainLoyalty" FOR SELECT USING (true);



CREATE POLICY "Enable update access for all users" ON "public"."Rewards" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable users to view their own data only" ON "public"."Profile" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Enable users to view their own data only" ON "public"."SavedCafe" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."Profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."RewardTransaction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SavedCafe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserChainLoyalty" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Waitlist" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT ALL ON FUNCTION "public"."handle_new_transaction_chain"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_transaction_chain"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_transaction_chain"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_reward_redeemed"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_reward_redeemed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_reward_redeemed"() TO "service_role";



GRANT ALL ON TABLE "public"."Bookmark" TO "anon";
GRANT ALL ON TABLE "public"."Bookmark" TO "authenticated";
GRANT ALL ON TABLE "public"."Bookmark" TO "service_role";



GRANT ALL ON TABLE "public"."Cafe" TO "anon";
GRANT ALL ON TABLE "public"."Cafe" TO "authenticated";
GRANT ALL ON TABLE "public"."Cafe" TO "service_role";



GRANT ALL ON TABLE "public"."CafeImages" TO "anon";
GRANT ALL ON TABLE "public"."CafeImages" TO "authenticated";
GRANT ALL ON TABLE "public"."CafeImages" TO "service_role";



GRANT ALL ON TABLE "public"."CafeMenu" TO "anon";
GRANT ALL ON TABLE "public"."CafeMenu" TO "authenticated";
GRANT ALL ON TABLE "public"."CafeMenu" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Cafe_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Cafe_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Cafe_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."Chains" TO "anon";
GRANT ALL ON TABLE "public"."Chains" TO "authenticated";
GRANT ALL ON TABLE "public"."Chains" TO "service_role";



GRANT ALL ON TABLE "public"."Profile" TO "anon";
GRANT ALL ON TABLE "public"."Profile" TO "authenticated";
GRANT ALL ON TABLE "public"."Profile" TO "service_role";



GRANT ALL ON TABLE "public"."RewardTransaction" TO "anon";
GRANT ALL ON TABLE "public"."RewardTransaction" TO "authenticated";
GRANT ALL ON TABLE "public"."RewardTransaction" TO "service_role";



GRANT ALL ON TABLE "public"."Rewards" TO "anon";
GRANT ALL ON TABLE "public"."Rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."Rewards" TO "service_role";



GRANT ALL ON TABLE "public"."SavedCafe" TO "anon";
GRANT ALL ON TABLE "public"."SavedCafe" TO "authenticated";
GRANT ALL ON TABLE "public"."SavedCafe" TO "service_role";



GRANT ALL ON TABLE "public"."UserChainLoyalty" TO "anon";
GRANT ALL ON TABLE "public"."UserChainLoyalty" TO "authenticated";
GRANT ALL ON TABLE "public"."UserChainLoyalty" TO "service_role";



GRANT ALL ON TABLE "public"."Waitlist" TO "anon";
GRANT ALL ON TABLE "public"."Waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."Waitlist" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Waitlist_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Waitlist_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Waitlist_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







