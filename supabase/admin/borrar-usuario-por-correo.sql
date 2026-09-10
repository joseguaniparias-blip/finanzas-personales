-- ─────────────────────────────────────────────────────────────────────────────
-- Borrar una cuenta a mano, desde Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠️ El botón "Delete user" de Authentication → Users NO sirve para esta base.
--    Hace un `delete from auth.users` a secas y confía en la cascada, igual que
--    la migración 006. Siete tablas apuntan a `pockets` con `on delete restrict`
--    y en PostgreSQL RESTRICT se verifica de inmediato: en cuanto la cascada
--    toca `pockets` con movimientos vivos, revienta con
--    `violates foreign key constraint "transactions_pocket_id_fkey"`
--    y no borra nada. Este script hace lo mismo que la migración 007: hijos
--    primero, padres después.
--
-- Uso: cambia el correo en la primera línea y ejecuta todo el bloque.

do $$
declare
  correo constant text := 'CAMBIAR@ejemplo.com';   -- ← el correo a borrar
  uid uuid;
begin
  select id into uid from auth.users where email = correo;
  if uid is null then
    raise notice 'No existe ninguna cuenta con el correo %', correo;
    return;
  end if;

  -- 1. Todo lo que referencia pockets con RESTRICT.
  delete from public.transactions       where user_id = uid;
  delete from public.debts              where user_id = uid;
  delete from public.collections        where user_id = uid;
  delete from public.saving_goals       where user_id = uid;
  delete from public.cadenas            where user_id = uid;
  delete from public.recurring_payments where user_id = uid;
  delete from public.scheduled_events   where user_id = uid;

  -- 2. Ahora sí, pockets.
  delete from public.pockets            where user_id = uid;

  -- 3. Lo que sólo tenía referencias `set null`.
  delete from public.platforms          where user_id = uid;
  delete from public.categories         where user_id = uid;

  -- 4. El usuario. Arrastra user_profiles por cascade.
  delete from auth.users where id = uid;

  raise notice 'Cuenta % (%) borrada. El correo queda libre para registrarse de nuevo.', correo, uid;
end $$;
