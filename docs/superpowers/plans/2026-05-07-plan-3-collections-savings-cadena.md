# Plan 3 — Cobros, Ahorros y Cadena

**Goal:** Complete the three remaining financial tracking modules — collections (money others owe you), savings goals with scheduled contributions, and cooperative group savings (ROSCA/cadena).

**Builds on:** Plan 1 (auth, onboarding, bolsillos), Plan 2 (ingresos, gastos, deudas, hooks, ConfirmEventSheet).

---

## Modules

### 3.1 Cobros
Mirror of Deudas but income-side. Money third parties owe the user.
- List with status badges: 🟢 En curso / ⚪ Indefinido / 🟡 Futuro / 🔔 Vence hoy
- Create/edit: person name, total (optional), installment, frequency, start date
- "Before app" adjustment: by installments collected or by remaining balance
- Detail: progress bar (if has_total), history, next due event
- Confirmation sheet: ✓ Cobré / Abono parcial / ↔ Otro bolsillo / ⏭ Posponer
- On confirm: balance += amount to dest_pocket, collected_amount updated

### 3.2 Ahorros
Savings goals with optional target and scheduled contributions.
- List of active goals with progress bars
- Create/edit: name, target (optional), contribution amount/%, frequency, source pocket
- Confirmation sheet: ✓ Guardé / ↔ Otro bolsillo / ⏭ Posponer
- On confirm: balance -= amount from source_pocket, saved_amount updated
- "Ahorro libre" badge when no target set

### 3.3 Cadena / Cooperativa
Rotating group savings (ROSCA / natillera).
- List of active cadenas with balance and timeline
- Create/edit: name, participants N, contribution per person, frequency, my_turn, pockets
- "Already started" toggle: current round + paid rounds → calculates opening balance
- Detail: N-segment visual timeline (past/current/my-turn/future), balance, next event
- Confirmation sheet: ✓ Pagué / ↔ Otro bolsillo / ⏭ Posponer
- Balance logic: negative before my turn, positive after payout received

---

## New Files

```
src/
├── hooks/
│   ├── useCollections.ts
│   ├── useSavingGoals.ts
│   └── useCadenas.ts
├── pages/
│   ├── collections/
│   │   ├── CollectionsPage.tsx
│   │   ├── CollectionForm.tsx
│   │   └── CollectionDetail.tsx
│   ├── savings/
│   │   ├── SavingsPage.tsx
│   │   └── SavingGoalForm.tsx
│   └── cadena/
│       ├── CadenaPage.tsx
│       ├── CadenaForm.tsx
│       └── CadenaDetail.tsx
```

**Updated:**
- `src/hooks/useScheduledEvents.ts` — add confirm/partial logic for collection, saving, cadena types
- `src/App.tsx` — routes /cobros, /ahorros, /cadena
- `src/pages/home/HomePage.tsx` — cards for new modules

---

## Tasks

- [x] Write plan doc
- [ ] Create hooks (useCollections, useSavingGoals, useCadenas)
- [ ] Update useScheduledEvents for new event types
- [ ] Build Collections module
- [ ] Build Savings module
- [ ] Build Cadena module
- [ ] Update App.tsx + HomePage
- [ ] Build verification
- [ ] Git commit
