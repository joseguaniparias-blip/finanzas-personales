# Identidad visual — "Neón hustle" (Dirección B)

**Fecha:** 2026-07-09
**Estado:** Aprobado (pendiente implementación)
**Track:** Identidad visual (sobre el track fundacional ya hecho)

## Contexto y decisión

El track fundacional dejó tokens `@theme`, a11y y limpieza, manteniendo el look. Ahora se le da **identidad de marca**: dirección **B "Neón hustle"** — cian eléctrico sobre base oscura + tipografía grotesca techy. Personalidad elegida por el usuario: *callejero / con actitud*.

Realidad técnica clave: la app usa ~972 clases `slate-*` crudas (la migración a tokens quedó deferida). Por eso la base oscura se re-tematiza **overrideando los stops de slate estructurales en `@theme`** (v4 permite redefinir `--color-slate-*`), lo que re-skinea globalmente sin reescribir clases.

## Objetivos

- Identidad "neón hustle" reconocible: acento cian de marca + tipografía propia + un elemento firma.
- Máximo impacto con mínimo riesgo, apoyándose en los tokens existentes.
- Mantener la semántica de dominio (ingreso=verde, gasto=rojo, etc.) intacta.

## No-objetivos

- No rehacer layouts ni flujos.
- No migrar los 972 usos crudos a tokens semánticos (sigue siendo incremental).
- No tocar la lógica de negocio.

## Diseño

### 1. Paleta (re-tema por override de slate + acento nuevo)

Override en `@theme` de los stops estructurales (re-skin global vía clases existentes):
- `--color-slate-950: #0A0B12` (bg) · `--color-slate-900: #0F1119` · `--color-slate-800: #14161F` (surface) · `--color-slate-700: #262A38` (line)
- Texto slate (100/300/400) se mantiene (ya cumple AA y luce bien).

Acento de marca (NUEVO token, distinto de los de dominio):
- `--color-accent: #22E3FF` (cian eléctrico) · texto sobre acento → `#04121A`.
- Usos: foco (`:focus-visible`), ítem activo del bottom-nav, número del saldo (hero), CTA primario, links.

Colisión resuelta:
- `recurring` (hoy cian `#22d3ee` ≈ acento) → **teal `#2DD4BF`**.
- `saving` (azul `#60a5fa`) se mantiene; adyacente al cian pero distinguible.

### 2. Tipografía (par, self-hosted vía @fontsource para que funcione offline en la PWA)

- **Display:** `Space Grotesk` (500/700) — títulos, labels de sección y **todas las cifras de dinero** con `font-variant-numeric: tabular-nums`.
- **Cuerpo/UI:** `Inter` (400/500) — labels, inputs, texto denso.
- Tokens: `--font-display: 'Space Grotesk', …` y `--font-sans: 'Inter', …` en `@theme`; `body` usa `font-sans`.
- Paquetes: `@fontsource/space-grotesk`, `@fontsource/inter` (importados en `main.tsx`; los cachea el service worker).

### 3. Elemento firma — "Tablero" (instrumento de moto)

El hero de Home se lee como el tablero de una moto:
- Saldo total = *readout* central en Space Grotesk cian con dígitos tabulares y una **regla cian de 2px** debajo (odómetro).
- Ingresos/gastos del período = dos *gauges* (chips) a los lados.
- El ítem activo del bottom-nav enciende un **tick cian** arriba (testigo encendido) — el motivo "corriente" que marca lo que está vivo.

## Alcance de implementación (fases)

- **A — Tipografía:** instalar @fontsource, tokens `--font-*`, `body`→Inter, aplicar `font-display` + `tabular-nums` a títulos y cifras en capa compartida + Home.
- **B — Paleta + firma:** override slate en `@theme`, añadir `--color-accent`, foco→cian, rediseño del hero "Tablero" en HomePage, tick cian en BottomNav activo.
- **C — Acento en acciones + colisión:** CTA primario azul→cian en capa compartida, `recurring`→teal.

## Verificación

- `tsc` + `build` + 37 tests verdes (sin cambio de comportamiento).
- Preview (logueado): inspeccionar Home — fuente Space Grotesk en el saldo, color de acento cian computado, regla del tablero, nav activo. Contraste AA del texto sobre la nueva base.

## Riesgos

- Override de slate afecta TODO lo que use esos stops → mitigar manteniendo shifts sutiles (siguen siendo azul-grises oscuros) y verificando Home/Config/Historial en preview.
- @fontsource aumenta el bundle → aceptable; mejora percibida alta y offline-friendly.
- Cian de marca vs azul de `saving` adyacentes → verificar que se distinguen; si no, mover `saving` a indigo.
