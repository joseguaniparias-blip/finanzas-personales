-- 006: reinicio de datos y eliminación de cuenta
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → pegar → Run

-- ─── Marca de reinicio ───────────────────────────────────────────────────────
-- Cuando un usuario borra todos sus datos, se estampa aquí. Cualquier otro
-- dispositivo compara esta marca con la suya al arrancar y, si el servidor es
-- más nuevo, limpia su copia local ANTES de vaciar el outbox — si no, re-subiría
-- las filas recién borradas.
alter table user_profiles add column if not exists wiped_at timestamptz;

-- ─── Eliminación de cuenta ───────────────────────────────────────────────────
-- La anon key no puede tocar auth.users, así que el borrado va por una función
-- SECURITY DEFINER. Sin parámetros y anclada a auth.uid(): sólo puede borrar a
-- quien la llama. Todas las tablas de datos declaran
-- `references auth.users on delete cascade`, así que este único delete limpia
-- el servidor entero.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'delete_my_account requiere una sesión activa';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;
