INSERT INTO auth.users(id,email) VALUES
 ('10000000-0000-4000-8000-000000000001','owner@example.test'),
 ('10000000-0000-4000-8000-000000000002','manager@example.test'),
 ('10000000-0000-4000-8000-000000000003','other@example.test'),
 ('10000000-0000-4000-8000-000000000004','reviewer@example.test'),
 ('10000000-0000-4000-8000-000000000005','free@example.test');
INSERT INTO public."AdminUser"(user_id,role) VALUES('10000000-0000-4000-8000-000000000004','admin');
INSERT INTO public."Chains"(id,name) VALUES
 ('20000000-0000-4000-8000-000000000001','North Star Coffee'),
 ('20000000-0000-4000-8000-000000000002','Other Partner'),
 ('20000000-0000-4000-8000-000000000003','Free Partner');
INSERT INTO public."Cafe"(id,chain_id,name,address,is_active,reward_code) VALUES
 (101,'20000000-0000-4000-8000-000000000001','North Star • Downtown','104 Victoria Avenue',true,'local-only-101'),
 (102,'20000000-0000-4000-8000-000000000001','North Star • Riverside','22 River Road',true,'local-only-102'),
 (103,'20000000-0000-4000-8000-000000000001','North Star • Old Town','8 Market Street',false,null),
 (201,'20000000-0000-4000-8000-000000000002','Other Partner Secret','Other address',true,null),
 (301,'20000000-0000-4000-8000-000000000003','Free One','First address',true,null),
 (302,'20000000-0000-4000-8000-000000000003','Free Two','Second address',true,null);
SELECT setval('public."Cafe_id_seq"',400,true);
INSERT INTO public.partner_accounts(chain_id,plan,timezone) VALUES
 ('20000000-0000-4000-8000-000000000001','paid','America/Regina'),
 ('20000000-0000-4000-8000-000000000002','free','UTC'),
 ('20000000-0000-4000-8000-000000000003','free','UTC');
INSERT INTO public.partner_memberships(id,chain_id,user_id,role) VALUES
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','cafe_manager'),
 ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','owner'),
 ('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000005','owner');
INSERT INTO public.partner_cafe_access(cafe_id,chain_id) SELECT id,chain_id FROM public."Cafe";
INSERT INTO public.partner_assignments VALUES('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',101);
INSERT INTO public.partner_items(id,chain_id,cafe_id,name,code,type,unit,balance,threshold) VALUES
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',101,'House espresso beans','BEANS','ingredient','g',1000,1500),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',101,'Whole milk','MILK','ingredient','ml',4000,1000),
 ('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001',102,'Retail coffee bags','BAGS','product','each',20,5);
INSERT INTO public.partner_movements(chain_id,item_id,cafe_id,quantity,resulting_balance,type,actor,reason)
 SELECT chain_id,id,cafe_id,balance,balance,'opening','10000000-0000-4000-8000-000000000001','Synthetic opening stock' FROM public.partner_items;
INSERT INTO public.partner_recipes(chain_id,name,yield,ingredients) VALUES
 ('20000000-0000-4000-8000-000000000001','House latte',1,'[{"item_id":"40000000-0000-4000-8000-000000000001","quantity":18,"unit":"g"},{"item_id":"40000000-0000-4000-8000-000000000002","quantity":200,"unit":"ml"}]');
INSERT INTO public."Rewards"(user_id,chain_id,earned_store,status,redeemed_cafe_id,redeemed_at)
 SELECT '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',101,'redeemed',102,now()-interval '1 day' FROM generate_series(1,4);
