CREATE FUNCTION public.partner_recipe_stock(p_recipe_id uuid, p_cafe_id bigint)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipe public.partner_recipes;
BEGIN
  IF auth.uid() IS NULL OR NOT public.partner_can_cafe(p_cafe_id) THEN
    RAISE EXCEPTION 'Café access required' USING ERRCODE = '42501';
  END IF;

  SELECT r.* INTO recipe
  FROM public.partner_recipes r
  JOIN public."Cafe" c ON c.id = p_cafe_id AND c.chain_id = r.chain_id
  WHERE r.id = p_recipe_id AND public.partner_paid(r.chain_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paid recipe access required' USING ERRCODE = '42501';
  END IF;

  -- Source rows supply ingredient identity. Only return balances at the checked café.
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'ingredient_id', ingredient.id,
      'stock_item_id', stock.id,
      'available', stock.balance
    )), '[]'::jsonb)
    FROM (
      SELECT DISTINCT (entry->>'item_id')::uuid AS id
      FROM jsonb_array_elements(recipe.ingredients) AS entry
    ) ingredient
    LEFT JOIN public.partner_items source
      ON source.id = ingredient.id AND source.chain_id = recipe.chain_id
      AND source.type = 'ingredient'
    LEFT JOIN public.partner_items stock
      ON stock.cafe_id = p_cafe_id AND stock.chain_id = recipe.chain_id
      AND stock.code = source.code AND stock.unit = source.unit
      AND stock.type = 'ingredient' AND stock.active
  );
END;
$$;

REVOKE ALL ON FUNCTION public.partner_recipe_stock(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_recipe_stock(uuid, bigint) TO authenticated;
NOTIFY pgrst, 'reload schema';
