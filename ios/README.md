# TrainGPT iOS Foundation

This directory contains an incremental iOS foundation for TrainGPT using **SwiftUI + MVVM + async/await**.

> Scope: This is a migration starter, not a destructive rewrite of the existing Next.js app.

## Architecture

- `App/`: app entry point and dependency composition.
- `Core/`: reusable entities and service protocols.
- `Infrastructure/`: concrete adapters (API client + keychain token store).
- `Features/`: feature slices (`Auth`, `Dashboard`) with views + view models.
- `Resources/`: placeholders for assets, strings, and environment-specific settings.

## What is implemented right now

- App root + auth-gated navigation (`RootView`).
- Auth feature UI + state management (`AuthView`, `AuthViewModel`).
- Dashboard feature UI + state management (`DashboardView`, `DashboardViewModel`).
- API client abstraction with bearer-token support.
- Keychain-backed token persistence.

## How to run it in Xcode (first time)

Because this repo currently stores **source files only** (no committed `.xcodeproj` yet), do this once:

1. Open Xcode → **File → New → Project… → iOS App**.
2. Name: `TrainGPTiOS`, Interface: `SwiftUI`, Language: `Swift`.
3. Save the project inside `ios/` as `ios/TrainGPTiOS.xcodeproj`.
4. In the project navigator, remove the auto-generated starter files (keep the target).
5. Drag `ios/TrainGPTiOS/` into the target and make sure **“Add to target: TrainGPTiOS”** is checked.
6. Set deployment target to iOS 17+ (recommended).
7. Build and run on Simulator (e.g. iPhone 16).

## How to test quickly (manual smoke test)

### 1) Launch behavior
- Run the app in simulator.
- Expected: you see the `AuthView` first unless a keychain token exists.

### 2) Empty-form validation
- Tap **Continue** with empty fields.
- Expected: inline error appears (`Please enter your email and password.`).

### 3) Network/auth path
- Enter any credentials and tap **Continue**.
- With no backend endpoint available yet, expected: friendly sign-in error (`Unable to sign in. Please try again.`).

### 4) Dashboard loading state
- After wiring real auth + endpoint, successful sign-in should route to dashboard.
- Expected dashboard states:
  - loading spinner
  - metric cards on success
  - fallback empty/error view on failure

## Configure backend endpoint

`AppEnvironment.current.apiBaseURL` currently points to:

- `https://api.traingpt.app`

Update this in `Infrastructure/AppEnvironment.swift` to your actual API URL while developing.

## Recommended next steps

1. Commit `TrainGPTiOS.xcodeproj` so teammates can run without local setup steps.
2. Add Supabase Swift SDK via Swift Package Manager.
3. Wire `AuthService` and `DashboardService` to real backend contracts.
4. Add unit tests for `AuthViewModel` and `DashboardViewModel`.
5. Add UI tests for sign-in and dashboard happy/sad paths.
