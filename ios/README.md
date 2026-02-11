# TrainGPT iOS Foundation

This directory introduces a production-ready iOS foundation for TrainGPT using **SwiftUI + MVVM + async/await**.

> Scope: This is an incremental migration starter, not a destructive rewrite of the existing Next.js app.

## Architecture

- `App/`: app entry point and root dependency setup.
- `Core/`: reusable domain entities and protocols.
- `Infrastructure/`: concrete adapters (Supabase config, API client, keychain-backed token storage).
- `Features/`: feature slices (`Auth`, `Dashboard`) with views + view models.
- `Resources/`: placeholders for assets, strings, and environment-specific settings.

## Why this baseline

- Keeps UI and logic modular so features can be ported one area at a time.
- Uses protocol-driven services for testability and future backend/API changes.
- Centralizes auth token handling for security and predictable session refresh.

## Next steps

1. Create an Xcode project (`TrainGPTiOS.xcodeproj`) and add these files.
2. Add Supabase Swift SDK in Xcode via SPM.
3. Wire real endpoints into `APIClient` and replace mock data in `DashboardService`.
4. Build parity screens incrementally:
   - Authentication
   - Coaching dashboard
   - Schedule/calendar
   - Progress insights
5. Add unit tests for view models and integration tests for auth/session flows.
