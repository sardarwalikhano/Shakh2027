# SHAKH 2027 — Phase 12 Finance & Wallet

## Delivered
- Customer, vendor, captain and platform wallets.
- Append-only wallet ledger with before/after balances.
- Idempotent wallet funding, withdrawal request, payout resolution and order settlement primitives.
- Rule-driven commission engine using basis points; no business rate is hardcoded.
- Wallet refund flow that reverses vendor/platform shares and credits the customer wallet after financial settlement.
- Legacy `profiles.wallet_balance_iqd` is synchronized from the customer wallet and is no longer writable by authenticated clients.
- Finance RLS, least-privilege grants and a live Finance Center UI.

## Deliberate boundaries
- No external payment gateway is claimed as integrated in this phase.
- No external payout provider is claimed as integrated in this phase.
- No commission rate is seeded; finance configuration must set the business rate deliberately.
- Captain delivery settlement allocation is handled in the delivery-finance phase.

## Release rule
Money movement must happen through narrow server-side functions. Ledger entries are immutable; corrections are compensating entries, not updates/deletes.

## Live migration sequence
20261004203511 finance_wallet_tables_v1
20261004203526 finance_wallet_index_ledger_v1
20261004203530 finance_wallet_indexes_v2
20261004203606 finance_wallet_functions_v1
20261004203641 finance_accounting_hardening_v1
20261004203659 finance_rls_and_grants_v1
20261004203709 finance_foreign_key_indexes_v1
20261004203804 finance_summary_and_funding_hardening_v1
