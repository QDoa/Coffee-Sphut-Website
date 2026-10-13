ALTER TABLE public."Post"
  ALTER COLUMN body TYPE text USING body::text;
