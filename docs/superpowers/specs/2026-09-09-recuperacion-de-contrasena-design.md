# Recuperación y cambio de contraseña

**Fecha:** 2026-09-09
**Estado:** aprobado

## Por qué

La app no tiene forma de recuperar una contraseña olvidada: un usuario que la
pierde pierde la cuenta. Tampoco puede cambiarla estando dentro.

El detonante fue un caso real: un usuario borró su cuenta, intentó registrarse
de nuevo varias veces y chocó con `email rate limit exceeded`. Investigando eso
salió que el proyecto usa el servicio de correo interno de Supabase, topado en
**2 correos por hora para todo el proyecto**. Ese tope también gobierna la
recuperación de contraseña, así que esta función nace con una restricción
conocida.

## Decisiones

| Decisión | Elegido | Descartado |
|---|---|---|
| Cómo vuelve el usuario | **Enlace mágico** (el de fábrica de Supabase) | Código de 6 dígitos |
| Alcance | **Recuperar + cambiar desde Configuración** | Sólo recuperar |

### Riesgo conocido del enlace mágico

En una PWA instalada en Android el enlace del correo abre en Chrome, **no** en
la app instalada. La sesión de recuperación cae en la ventana equivocada y el
usuario ve su app instalada pidiéndole todavía la contraseña vieja. Se aceptó a
cambio de no tocar las plantillas de correo de Supabase. Si aparece en soporte,
la salida es migrar a código de 6 dígitos (`verifyOtp` con `type: 'recovery'`).

### El tope de correos

`resetPasswordForEmail` gasta uno de los 2 correos/hora del proyecto. La función
queda construida y correcta, pero **no es usable en producción hasta que haya
SMTP propio**. El cambio desde Configuración no manda correo y sirve desde ya.

## Arquitectura

Cinco unidades nuevas, cada una con una responsabilidad:

| Archivo | Hace | Depende de |
|---|---|---|
| `src/lib/password.ts` | Valida largo y coincidencia. Funciones puras. | nada |
| `src/components/auth/NewPasswordForm.tsx` | Las dos casillas, la validación y el botón. Compartido. | `password.ts` |
| `src/pages/auth/ForgotPassword.tsx` | Pide correo, llama `resetPasswordForEmail`. | `supabase`, `authErrors` |
| `src/pages/auth/ResetPassword.tsx` | Pantalla de contraseña nueva tras el enlace. | `NewPasswordForm`, `supabase` |
| `src/hooks/useRecoveryMode.ts` | ¿Este usuario llegó por un enlace de recuperación? | `supabase` |

`useRecoveryMode` va aparte de `useAuth` a propósito: `useAuth` ya se instancia
dos veces (en `AppRoutes` y en `AuthPage`), y meterle estado de recuperación
volvería ambiguo cuál de las dos instancias manda. El hook nuevo lo consume sólo
`AppRoutes`.

## Flujo

1. `AuthPage` gana un modo `'forgot'` en su máquina de estados `mode`. Sin ruta
   nueva.
2. `resetPasswordForEmail(email, { redirectTo: window.location.origin })`.
3. El usuario toca el enlace → vuelve con los tokens en el hash → supabase-js
   crea la sesión y dispara `PASSWORD_RECOVERY`.
4. **`AppRoutes` consulta `recovering` antes que nada** — antes del "Cargando…",
   del onboarding y de las rutas. Es el punto crítico: sin esto el usuario cae
   en su tablero con la contraseña vieja y nunca ve la pantalla.
5. `updateUser({ password })` → `endRecovery()` → sigue al tablero, ya con sesión.
6. Configuración → sección `password` (el `section` state machine existente) →
   el mismo `NewPasswordForm` → `updateUser`. Sin correo.

## Errores

Todo pasa por `authErrorMessage` (`src/lib/authErrors.ts`). Se agrega
`same_password` → "La contraseña nueva debe ser distinta a la actual".

`ForgotPassword` responde **lo mismo exista o no el correo**: "Si hay una cuenta
con ese correo, te llegará un enlace". Decir "ese correo no existe" convertiría
la pantalla en un detector de qué correos tienen cuenta. La única excepción es
el rate limit, que sí se muestra — ahí el usuario necesita saber que debe esperar.

## Pruebas

- `password.ts`: largo mínimo, coincidencia, mensajes.
- `authErrors.ts`: `same_password`.
- `useRecoveryMode`: se enciende con `PASSWORD_RECOVERY`, se apaga con `endRecovery`.
- `NewPasswordForm`: no envía si no coinciden ni si es corta; envía la contraseña.
- `ForgotPassword`: mismo mensaje con correo existente y con inexistente; el
  rate limit sí se muestra.

## Fuera de alcance

Medidor de fuerza, requisitos de mayúsculas o símbolos, y cerrar sesión en los
otros dispositivos al cambiar la contraseña. Ninguno fue pedido; los tres suman
fricción o superficie.

## Trabajo manual en Supabase

1. Authentication → URL Configuration → **Site URL** de producción.
2. **Redirect URLs**: la de producción más un comodín para los previews de
   Vercel, o el enlace se rompe en cada preview.
3. SMTP propio (Resend, Brevo) para pasar del tope de 2 correos/hora.
