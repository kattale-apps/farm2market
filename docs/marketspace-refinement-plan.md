# MarketSpace refinement plan

## Goal
Keep the current trading engine intact and layer a MarketSpace publication and visibility model on top of it instead of rewriting the product.

## Product direction
- MarketSpace is a discovery/publication layer, not a separate source of truth.
- The canonical listing record remains the production ledger and trade engine.
- User capabilities are more important than hard-coded category assumptions.
- Verification-aware visibility is required for listings marked as visible only to verified accounts.
- The app should remain backward compatible with the current farmer/trader flows while enabling broader market publication.

## Guardrails
- Preserve legacy listing behavior when classification data is absent.
- Do not break current wallet, listing, or onboarding flows.
- Use thin metadata additions rather than broad schema migrations.
- Prefer capability checks and verification status over rigid role assumptions.
- Keep UX mobile-first and semi-literate.
- GPS capture should be best effort and non-blocking.
- Superadmin verification should remain auditable and controlled.

## Architecture approach
1. Normalize listing classification values at the server boundary.
2. Persist metadata for list type, category, visibility, and publication toggle.
3. Gate publication using account capability + verification + vendor opt-in rules.
4. Enforce viewing access from the server for MarketSpace queries.
5. Leave legacy listing and payment flows for later refinement rather than rewriting them now.

MarketSpace is intentionally a thin, public-facing layer layered on top of the existing Farm2Market trading and listing systems. The canonical inventory and trade engine remains the real source of truth for listings, pricing, locking, and fulfillment; MarketSpace adds discovery, selection, classification, and visibility rules without introducing a parallel ledger or a second operational workflow. This keeps the product compatible with today’s buyer, seller, and trader operations while allowing a narrower public board to evolve independently from the commercial engine.

## Phase 1 - listing classification foundation
Implemented.
- Added safe default listing metadata in the listing normalization layer.
- Preserved behavior for legacy listings using default values.
- Added publication and visibility fields with conservative defaults.
- Updated the create listing UI to expose listing type, visibility, and MarketSpace publication controls.

## Phase 2 - access control and verification gating
Implemented.
- Added `canPublishListingToMarketSpace` helper to evaluate publication eligibility.
- Added `canViewListingForUser` helper to enforce verified-only visibility.
- Added `isVerifiedMarketspaceUser` helper for verification-aware checks.
- Added a regression test validating vendor vs. unverified seller behavior.

## Phase 3 - board visibility and filtering
Implemented.
- Added `matchesVisibilityFilter` to keep the board feed aligned with the public visibility policy.
- Applied visibility checks in the MarketSpace list and search queries.
- Exposed a board-level visibility toggle in the MarketSpace browse UI.

## Phase 4 - role capability mapping and wallet alignment
Implemented.
- Centralized publication eligibility in `getMarketSpaceRoleCapability` with a single source of truth for MarketSpace serializer roles.
- Mapped direct MarketSpace publishers: admin, vendor, store, trader, transporter, processor, exporter, and contractor.
- Kept farmer and buyer publication gated behind explicit opt-in while preserving the legacy listing flows.
- Wired the capability helper into the listing publication guard so role checks and visibility checks remain aligned.
- Updated the shared wallet mapping so commercial MarketSpace actors use the trader wallet, while farmer and buyer flows remain separate.

Not yet fully implemented, but scoped and safe:
- Add deep links and QR publication flow for listings.
- Expand UI messaging and trust notices for verified-only vs. all-public listings.

## Validation
Verified with the project test harness:
- `& 'C:\Program Files\nodejs\node.exe' '.\node_modules\tsx\dist\cli.mjs' --test '.\tests\listing-classification.test.ts'`
- Result: 5 tests passed, 0 failed

Also checked compile safety:
- `& 'C:\Program Files\nodejs\node.exe' '.\node_modules\typescript\bin\tsc' --noEmit -p '.\tsconfig.json'`
- Result: success with no TypeScript errors

## Files touched in this phase
- [convex/listings.ts](../convex/listings.ts)
- [tests/listing-classification.test.ts](../tests/listing-classification.test.ts)
