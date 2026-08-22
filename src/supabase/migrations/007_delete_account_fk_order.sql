-- 007: eliminar cuenta sin depender del orden de cascada
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → pegar → Run

-- La versión de la 006 hacía sólo `delete from auth.users` y confiaba en que el
-- `on delete cascade` de cada tabla limpiara el resto. No es seguro: seis tablas
-- referencian `pockets` con `on delete restrict` (migraciones 001 y 002), y en
-- PostgreSQL RESTRICT se verifica de inmediato — no se puede diferir al final de
-- la sentencia como haría NO ACTION. Cuando la cascada borra `pockets`, si las
-- filas de `transactions` todavía existen, el borrado revienta con
-- `violates foreign key constraint "transactions_pocket_id_fkey"`. El orden en
-- que Postgres procesa las cascadas hacia varias tablas hijas no está
-- garantizado, así que el resultado sería una lotería.
--
-- Es el mismo fallo que apareció al probar "Empezar de cero" en el cliente. Aquí
-- se resuelve igual: borrar hijos antes que padres, explícitamente, y sólo
-- después quitar el usuario de auth (que ya sólo arrastra `user_profiles`).

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'delete_my_account requiere una sesión activa';
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
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;
