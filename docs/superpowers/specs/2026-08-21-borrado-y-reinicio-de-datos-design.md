# Borrado y reinicio de datos — diseño

Fecha: 2026-08-21

## Problema

La app no ofrece ninguna forma de deshacer la configuración inicial ni de darse
de baja. Un usuario que se equivocó en el onboarding, que prestó el teléfono o
que simplemente quiere irse no tiene salida: la única opción es cerrar sesión y
dejar los datos vivos en la nube para siempre.

## Alcance

Dos acciones, en una "Zona de peligro" al final de Configuración:

1. **Empezar de cero** — borra todos los datos (nube, este dispositivo y los
   demás dispositivos del usuario), conserva la cuenta y devuelve al onboarding.
2. **Eliminar mi cuenta** — lo anterior, más el usuario de Supabase Auth.
   Irreversible.

Ambas ofrecen descargar un JSON con todos los datos antes de ejecutar, y exigen
escribir la palabra `BORRAR` para habilitar el botón.

**Fuera de alcance:** borrar solo el historial de movimientos conservando
bolsillos. Se descartó porque `pocket.balance` es la fuente de verdad y no se
deriva del ledger (ver el fix de julio de 2026 que quitó el chequeo de
integridad); borrar movimientos sin recalcular saldos dejaría la app en un
estado incoherente. También fuera de alcance: soft-delete con `deleted_at`
(duplicaría la lógica de todas las queries) y borrado programado a 30 días
(necesitaría un cron que el proyecto no tiene).

## Restricciones que condicionan el diseño

- **Los hooks de sync convertirían un borrado masivo en cientos de requests.**
  `setupSyncHooks` engancha `deleting` en cada tabla de Dexie. Hay que
  silenciarlos durante el wipe.
- **El outbox resucita filas borradas.** Los upserts parqueados en `sync_queue`
  se re-empujan al reconectar. Purgarlo es parte del borrado, no un extra.
- **La anon key no puede tocar `auth.users`.** Eliminar la cuenta exige un RPC
  `SECURITY DEFINER` o una Edge Function.
- **Offline-first significa que otro dispositivo puede revivirlo todo.** Su
  copia local sobrevive al borrado y la re-sube al reconectar.

## Arquitectura

Tres módulos nuevos, cada uno con una responsabilidad:

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `src/lib/exportData.ts` | Leer Dexie y armar/descargar el JSON de respaldo | `db` |
| `src/lib/wipe.ts` | Las dos operaciones de borrado | `db`, `supabase`, `sync` |
| `src/pages/config/DangerZone.tsx` | UI de confirmación, estado y errores | `wipe`, `exportData` |

Cambios en código existente, todos quirúrgicos:

- `src/lib/sync.ts` — exporta `withSyncSuspended(fn)`, que levanta el flag
  `syncing` **que ya existe** mientras corre el borrado. Reusa el guard que ya
  protege el pull en lugar de inventar un mecanismo nuevo. También añade
  `wiped_at` al allowlist de `user_profiles`.
- `src/App.tsx` — el efecto de login gana un paso previo: `checkRemoteWipe`.
- `src/pages/config/ConfigPage.tsx` — dos entradas nuevas en `Section` y el
  montaje de `<DangerZone/>`. La página ya ronda las 500 líneas; la UI del
  borrado vive en su propio archivo.
- `src/types/index.ts` — `UserProfile.wiped_at?: string | null`.

## Flujo — Empezar de cero

```
1. Bloquear si navigator.onLine === false
2. SERVIDOR: delete().eq('user_id', uid) en las 10 tablas de datos
   └─ si falla cualquiera → abortar, NO tocar nada local, ofrecer reintentar
3. SERVIDOR: user_profiles → onboarding_completed=false, wiped_at=now()
   (conserva el nombre: sirve de prefill en el onboarding)
4. LOCAL, con hooks suspendidos:
   a. db.sync_queue.clear()      ← primero, o el outbox resucita filas
   b. clear() de las 10 tablas
   c. user_profiles.put({ …, onboarding_completed:false, wiped_at })
5. window.location.reload() → cae en OnboardingFlow
```

**Servidor primero, siempre.** Si se limpiara local primero y el paso 2 fallara,
el siguiente `pullFromSupabase` restauraría todo y el reinicio se desharía en
silencio. Cada paso es idempotente: reintentar tras un fallo parcial termina el
trabajo.

El reload en vez de manejar el estado en React evita que los `liveQuery` vivos
reaccionen a una base a medio vaciar.

## Flujo — Eliminar cuenta

Migración `006_account_deletion.sql`:

```sql
alter table user_profiles add column if not exists wiped_at timestamptz;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'no session'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;
```

Sin parámetros y anclada a `auth.uid()`: la función solo puede borrar a quien la
llama. Como todas las tablas declaran `references auth.users on delete cascade`,
ese único `delete` limpia el servidor entero.

Se eligió el RPC sobre una Edge Function porque el proyecto hoy no tiene ninguna
función desplegada ni el CLI de Supabase configurado; el RPC es un archivo SQL
más, igual que los cinco que ya existen.

Cliente:

```
1. rpc('delete_my_account')  → si error, abortar y mostrar
2. LOCAL, con hooks suspendidos: clear() de las 11 tablas + sync_queue
3. supabase.auth.signOut()   → limpia el token del localStorage
4. window.location.reload()  → AuthPage
```

## Propagación a otros dispositivos

`wiped_at` en `user_profiles`. En `App.tsx` el efecto de login pasa de dos pasos
a tres:

```
checkRemoteWipe(uid) → flushSyncQueue() → pullFromSupabase(uid)
```

`checkRemoteWipe` lee `wiped_at` del servidor y lo compara con el local. Si el
del servidor es estrictamente más nuevo, limpia Dexie **antes** de que el outbox
se vacíe — de lo contrario ese dispositivo re-subiría lo que se acaba de borrar.
El dispositivo que ejecutó el borrado ya tiene la misma marca, así que para él
es un no-op. Sin conexión el chequeo falla en silencio y se reintenta en el
siguiente arranque.

## Manejo de errores

- **Offline:** bloqueado de entrada, con el motivo visible. No permitimos
  borrados a medias.
- **Fallo parcial en el servidor:** local queda intacto y el mensaje dice
  explícitamente que *no se borró nada en este dispositivo*, con botón
  "Reintentar".
- **Durante la ejecución:** pasos visibles ("Borrando en la nube…" / "Limpiando
  este dispositivo…"), no un spinner mudo. Un borrado que parece colgado es
  cuando la gente cierra la app a mitad.
- La pantalla de confirmación cuenta el daño en concreto ("Se borrarán 412
  movimientos, 5 bolsillos, 2 deudas…"), leído de Dexie. Es más disuasorio que
  un genérico "esto es irreversible".

## Pruebas

Con `fake-indexeddb` real y Supabase mockeado, siguiendo el patrón de
`syncColumns.test.ts` y `useAuth.test.ts`:

- `wipe.test.ts` — el reset limpia las 10 tablas y `sync_queue`; conserva
  `user_profiles` con `onboarding_completed=false` y `wiped_at`; **aborta sin
  tocar Dexie si el servidor falla**; `deleteAccount` limpia todo incluido el
  perfil; `checkRemoteWipe` limpia solo cuando el `wiped_at` del servidor es
  estrictamente más nuevo.
- `exportData.test.ts` — el respaldo incluye todas las tablas y solo filas del
  usuario.
- `DangerZone.test.tsx` — el botón sigue deshabilitado hasta escribir `BORRAR`
  exacto; offline lo bloquea.

## Decisiones descartadas

- **Re-autenticación con contraseña antes de eliminar cuenta.** Se propuso y el
  usuario la dejó fuera. Escribir `BORRAR` es la única fricción.
- **Papelera / deshacer.** Con datos ya borrados del servidor sería una promesa
  falsa. El respaldo descargable es el sustituto honesto.
