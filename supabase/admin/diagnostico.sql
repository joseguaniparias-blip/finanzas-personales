-- ─────────────────────────────────────────────────────────────────────────────
-- Diagnóstico rápido del estado de borrado de cuentas
-- Supabase → SQL Editor → pegar → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. ¿Qué versión de delete_my_account() está viva?
--    version_007 = true  → la buena (borra hijos antes que padres)
--    version_007 = false → la 006, que revienta por FK. Corre la migración 007.
select
  (prosrc like '%public.transactions%') as version_007,
  (prosrc like '%delete from auth.users%') as borra_auth_user
from pg_proc
where proname = 'delete_my_account';

-- 2. ¿Existe la columna wiped_at? (migración 006) — esperado: 1 fila
select column_name
from information_schema.columns
where table_name = 'user_profiles' and column_name = 'wiped_at';

-- 3. ¿Una cuenta "borrada" sigue viva? Cambia el correo.
select id, email, created_at, email_confirmed_at, last_sign_in_at
from auth.users
where email = 'CAMBIAR@ejemplo.com';

-- 4. Si el paso 3 devolvió una fila, esto dice por qué no se pudo borrar:
--    cualquier conteo > 0 es lo que la cascada de la 006 no puede saltar.
with u as (select id from auth.users where email = 'CAMBIAR@ejemplo.com')
select 'transactions'       as tabla, count(*) from public.transactions       where user_id = (select id from u)
union all select 'pockets',            count(*) from public.pockets            where user_id = (select id from u)
union all select 'debts',              count(*) from public.debts              where user_id = (select id from u)
union all select 'collections',        count(*) from public.collections        where user_id = (select id from u)
union all select 'saving_goals',       count(*) from public.saving_goals       where user_id = (select id from u)
union all select 'cadenas',            count(*) from public.cadenas            where user_id = (select id from u)
union all select 'recurring_payments', count(*) from public.recurring_payments where user_id = (select id from u)
order by 2 desc;

-- 5. Usuarios que quedaron atrapados sin confirmar el correo.
--    Apagar "Confirm email" NO los libera: siguen con email_confirmed_at nulo y
--    al entrar reciben "Email not confirmed". Hay que confirmarlos a mano.
select id, email, created_at
from auth.users
where email_confirmed_at is null
order by created_at desc;

-- 6. Confirmarlos a todos de una (sólo si apagaste "Confirm email").
-- update auth.users
--   set email_confirmed_at = now()
-- where email_confirmed_at is null;
