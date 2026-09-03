# Identity Decisions Final

## Recorded decision set

The immutable Phase 4.1 package remains unchanged. Its 40 rows were copied to `phase4-user-decisions-final.csv`, where the approved decisions and explanatory notes were recorded: 19 PRIMARY_LINK, 9 DEFER, 9 KEEP_CANONICAL_ONLY, 2 INVALID_LOOKING_VALUE, and 1 NON_WORKER_VALUE. All 19 primary Production UUIDs are unique.

This is a local reconciliation decision artifact, not a database mutation. No identity, UUID, work log, transaction, or schema was changed.

## Yeosu structure

- S067 PRIMARY_LINK: `7cdd5e25-3c79-443f-bd17-105508a72661` — base PC-member repair.
- S067 LEGACY_COMPONENT: `3471d20e-b920-4f46-94ae-4b67c2fcbc10` — advance repair, legacy budget 6,500,000.
- S067 LEGACY_COMPONENT: `9ddbc746-f1a2-47da-99d5-483239c91fb4` — second/follow-up PC repair.
- S068 PRIMARY_LINK: `819c0b09-d093-4717-a09d-86896d527845` — independent projecting-balcony cutting/hole-drilling scope.
- S068 LEGACY_COMPONENT: `908f5f78-d868-46b6-bdfa-2fb6ae5a00cc` — separately preserved related row.

S067 and S068 remain separate profit units. Legacy components are neither primary claims nor instructions to delete, merge, or deactivate rows. The S067 legacy budgets 33,489,000 and 6,500,000 reconcile to the canonical contract 39,989,000.

## Reviewed overrides and collision protection

- S112 uses Production complex-3 UUID `581e9847-9126-4932-a66b-f4429c2f2b0f`, replacing the Phase 4 complex-5 candidate.
- S118 uses `90a0a1ef-2507-46b7-a1a1-3b68a33e921b`, supported by the matching customer and 27,200,000 contract; it remains separate from S035.
- S148 claims `216a794c-d602-4735-9bce-4adbcf870b9a`. S167 is KEEP_CANONICAL_ONLY and does not reuse that UUID.
- `외국인(필립)` links to `9137b6a9-30e9-4b6c-a0ce-417d8d311a5b`. Separate `필립` UUID `f6490d29-623f-44a5-9e6a-417464554745` is retained and not merged.

## Deferred and retained identities

Nine Y1/CUB or insufficient-evidence identities remain DEFER for Phase 5 chronology and Phase 6 expense evidence. DEFER does not discard them. Nine canonical-only identities remain future dry-run creation candidates; this phase does not insert them. `임지만` retains unresolved historical labor evidence without a guessed daily rate.

The two invalid-looking Production customer values are retained and flagged. `1톤스카이` is classified NON_WORKER_VALUE: its row is preserved, but it is not treated as a person identity or merged into a worker.

## Immutable resolution map

`phase4-identity-resolution-map.json` is the sole approved local input for the next reconciliation phase. It separates primary links, legacy components, deferred identities, canonical-only identities, invalid values, and non-worker values. Consumers must reject duplicate primary UUID claims and must never interpret a legacy component as permission to mutate Production.

Unresolved identities may be revisited only with row-level chronology or expense evidence in Phase 5/6. Phase 5 has not started.
