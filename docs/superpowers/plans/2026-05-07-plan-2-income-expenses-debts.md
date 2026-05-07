# Plan 2 — Ingresos, Gastos y Deudas

**Goal:** Build the three core financial tracking modules — platform income registration (daily + weekly payout), expense tracking (quick + detailed + categories), and debt management (with scheduled event confirmation flow).

**Builds on:** Plan 1 (auth, onboarding, bolsillos, DB schema, types).

---

## Modules

### 2.1 Ingresos por Plataforma
- Daily income form: select platform → total amount → cash toggle → pocket routing
- Auto-update: cash portion → selected pocket, digital portion → platform wallet
- Income history grouped by platform and week
- Weekly payout confirmation (platform_payout scheduled event)

### 2.2 Gastos
- Quick mode: amount + pocket (2 taps)
- Detailed mode: amount + category + pocket + note
- Categories list with monthly spending limits and alert badges
- Default categories seeded on first load

### 2.3 Deudas
- List with progress bars (has_total) and indefinite badges
- Create/edit form: name, total (optional), installment, frequency, payment day, source pocket
- "Before app" adjustment: by installments paid or by remaining balance
- Debt detail: history of payments, progress bar, next due
- Scheduled event confirmation: ✓ Pagué / Abono parcial / ↔ Otro bolsillo / ⏭ Posponer

### 2.4 RegisterPage (central + button)
- Mode selector: Ingreso / Gasto
- Income sub-flow opens IncomeForm sheet
- Expense sub-flow opens ExpenseForm sheet

---

## New Files

```
src/
├── hooks/
│   ├── usePlatforms.ts
│   ├── useCategories.ts
│   ├── useTransactions.ts
│   ├── useDebts.ts
│   └── useScheduledEvents.ts
├── components/shared/
│   ├── AmountInput.tsx
│   └── ConfirmEventSheet.tsx
├── pages/
│   ├── register/
│   │   └── RegisterPage.tsx        ← replace placeholder
│   ├── income/
│   │   ├── IncomePage.tsx
│   │   └── IncomeForm.tsx
│   ├── expenses/
│   │   ├── ExpensesPage.tsx
│   │   └── ExpenseForm.tsx
│   └── debts/
│       ├── DebtsPage.tsx
│       ├── DebtForm.tsx
│       └── DebtDetail.tsx
```

**Updated:** `src/App.tsx` — add /ingresos, /gastos, /deudas routes and pass userId.

---

## Tasks

- [x] Write plan doc
- [ ] Create hooks (usePlatforms, useCategories, useTransactions, useDebts, useScheduledEvents)
- [ ] Create shared components (AmountInput, ConfirmEventSheet)
- [ ] Build RegisterPage
- [ ] Build Income module (IncomePage + IncomeForm)
- [ ] Build Expenses module (ExpensesPage + ExpenseForm)
- [ ] Build Debts module (DebtsPage + DebtForm + DebtDetail)
- [ ] Update App.tsx
- [ ] Build verification (no TS errors)
- [ ] Git commit
