# Frontend fundacional — sistema de tokens y limpieza

**Fecha:** 2026-07-09
**Estado:** Aprobado (pendiente de plan de implementación)
**Track:** Frontend profesional — nivel *fundacional* (bajo riesgo, mismo look oscuro)

## Problema

La UI de "Mis Finanzas" funciona pero es frágil y difícil de mantener por dentro:

- **No hay sistema de tokens real.** El `tailwind.config.ts` define una paleta `brand.*` que en Tailwind v4 (`@import "tailwindcss"`, sin `@config`) **se ignora por completo** — 0 usos de `brand-*` en el código. Los colores viven como ~972 clases crudas (`slate-*`, `emerald-*`, `red-*`, …) repetidas a mano en 40 archivos, con inconsistencias reales (p. ej. "ahorro" usa emerald en un lado y blue en otro).
- **Bug de clases dinámicas.** En el grid de Módulos de Home se construyen clases por interpolación (`` bg-${m.color}-600/20 ``). Tailwind v4 no genera clases construidas así salvo safelist → frágil, se rompen en silencio al cambiar un color.
- **Código muerto.** `src/App.css` es CSS del scaffold de Vite (`.hero`, `#next-steps`, `.counter`) sin uso; la paleta `brand` del config está muerta; hay assets de plantilla (`react.svg`, `vite.svg`, `hero.png`) posiblemente sin referencia.
- **Iconografía mixta.** Se mezcla Lucide (vectorial) con emoji como iconos primarios. Parte del emoji es **dato del usuario** (bolsillos, categorías, plataformas), pero otra parte es puramente estructural/decorativa (`⚠️`, `📅`, `✅`, puntos de tipo de evento, chrome de Config).
- **Accesibilidad.** Textos `slate-500/600` sobre fondo oscuro no cumplen contraste AA; foco de teclado inconsistente; no se respeta `prefers-reduced-motion` de forma explícita.

## Objetivos

- Establecer un **sistema de tokens semánticos** como única fuente de verdad, vía `@theme` de Tailwind v4.
- Arreglar el bug de clases dinámicas de Home.
- Eliminar el código/CSS/assets muertos.
- Unificar la iconografía **estructural** a Lucide, **conservando el emoji que elige el usuario**.
- Cumplir un piso de accesibilidad (contraste AA, foco visible, targets ≥44px, reduced-motion).
- Mantener el **look actual** (oscuro): los tokens se mapean a los valores vigentes; no es un rediseño visual.

## No-objetivos (YAGNI)

- **No** reescribir los ~972 usos de color crudo de las 40 pantallas (migración parcial — ver Alcance).
- **No** introducir tipografía de display ni "elemento firma" (eso es el track de *identidad*, no este).
- **No** cambiar el tema oscuro por otro, ni rehacer layouts.
- **No** tocar el emoji elegido por el usuario ni su selector.

## Enfoque técnico

**Tailwind v4 `@theme` en `src/index.css`.** Se definen variables CSS semánticas dentro de `@theme`, lo que genera utilidades (`bg-surface`, `text-income`, `border-subtle`, …). Es la forma idiomática de v4 y habilita theming futuro sin refactor.

*Alternativa descartada:* centralizar en constantes TS (`colors.ts`) — no da variables CSS, no resuelve las clases dinámicas y es menos idiomático.

## Diseño

### 1. Sistema de tokens (`@theme`)

Tokens mapeados a los valores actuales (el look no cambia). Nombres semánticos:

**Superficies y estructura**
- `--color-bg` → slate-950 · `--color-surface` → slate-800 · `--color-surface-muted` → slate-900 · `--color-border` → slate-700 · `--color-border-subtle` → slate-700/50

**Texto** (tres niveles, todos AA sobre el fondo — ver §5)
- `--color-text` → slate-100 (principal)
- `--color-text-muted` → slate-300 (secundario)
- `--color-text-faint` → slate-400 (terciario/labels). Se **retira** el uso de `slate-500/600` para texto, que no cumple AA.

**Dominio** (estandariza la deriva actual; se fija una sola definición por concepto)
- `income` / `collection` → emerald-400 (#34d399)
- `expense` / `debt` → red-400 (#f87171)
- `saving` → blue-400 · `cadena` → violet-400 · `platform` → orange-400 · `recurring` → cyan-400

**Semánticos de UI**
- `success` → emerald · `danger` → red · `warning` → amber · `info` → blue

Se migra el `brand.*` muerto del `tailwind.config.ts` a este `@theme` y se **elimina** el config (o se deja mínimo si algo lo requiere).

### 2. Arreglo del bug de clases dinámicas

En el grid de Módulos de `HomePage.tsx`, reemplazar `` `border-${m.color}-600/20 bg-${m.color}-600/5 text-${m.color}-400` `` por un **mapa estático** de clases completas por tipo de módulo (o utilidades de token `text-<dominio>` / `bg-<dominio>/…`), de modo que Tailwind las genere de forma garantizada.

### 3. Limpieza de código muerto

- Borrar `src/App.css` (scaffold de Vite, sin uso).
- Quitar la paleta `brand` muerta (y el `tailwind.config.ts` si queda vacío).
- Eliminar assets de plantilla sin referencia (`src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`) tras confirmar que no se importan.

### 4. Pasada de iconografía

Reemplazar emoji **estructural/decorativo** por Lucide, conservando el emoji del usuario:
- `⚠️` → `AlertTriangle` · `📅` → `Calendar` · `✅` → `CheckCircle`
- `icon` de `EVENT_META` y los puntos de tipo de evento en Home → iconos Lucide por tipo
- Chrome de Config (`👁️`, `🛵`, `🛡️`) → Lucide (`Eye`, `Bike`/`Truck`, `ShieldCheck`), verificando disponibilidad en la versión instalada de `lucide-react`; si un icono no existe, usar el equivalente presente.
- **Intacto:** iconos de bolsillos, categorías y plataformas (los elige el usuario).

### 5. Accesibilidad (piso de calidad)

- Subir textos informativos de bajo contraste (`slate-500/600`) a un token que cumpla **WCAG AA** sobre el fondo.
- Asegurar `focus-visible` visible en todo lo interactivo (botones, links, inputs).
- Targets táctiles ≥44px en acciones primarias.
- Respetar `prefers-reduced-motion` (desactivar/atenuar transiciones no esenciales).

### 6. Alcance de migración — **parcial**

Se establece el sistema de tokens y se migra a él:
- **Capa compartida:** `src/components/shared/*`, `src/components/layout/*`.
- **Pantallas de alto tráfico:** Home, Reports, Config, Historial.

El resto de pantallas **no** se reescribe en esta pasada; adoptan tokens de forma incremental. Se documenta la convención (usar tokens en código nuevo) en `CONTEXTO.md`.
> Nota de alcance explícita: quedan pantallas con color crudo tras esta pasada (por diseño, no por omisión). Un barrido completo de las 40 pantallas puede ser un track posterior.

## Verificación

- **Sin cambio de comportamiento** → los 37 tests existentes deben seguir verdes; `tsc -b` y `build` limpios.
- **Visual:** arrancar el preview y comparar Home / Reports / Config / Historial contra el look actual (screenshots); confirmar que no hay regresiones de color, que el foco es visible y que el grid de Módulos conserva sus colores (valida el arreglo de clases dinámicas).
- **Contraste:** verificar con `preview_inspect` los tokens de texto sobre superficie.

## Riesgos

- **Regresión visual sutil** al migrar clases crudas a tokens si un valor mapeado no coincide exactamente → mitigar mapeando 1:1 a los valores actuales y verificando por pantalla las 4 migradas.
- **Iconos Lucide ausentes** en la versión instalada (`lucide-react` ^1.14.0, versión inusual) → verificar cada icono antes de usarlo; fallback al equivalente disponible.
- **`@theme` mal formado** rompe el build de Tailwind → validar con `build` tras definir los tokens.
