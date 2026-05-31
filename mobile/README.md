# TrainGPT Mobile

Native iOS app foundation built with Expo and React Native.

## Local setup

Create a local `mobile/.env` file with:

```txt
EXPO_PUBLIC_SUPABASE_URL=<your Supabase project URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your Supabase anon key>
EXPO_PUBLIC_API_BASE_URL=https://traingpt.co
```

Then run:

```bash
yarn install
yarn start
```

For iOS simulator:

```bash
yarn ios
```

## Current scope

- Native tab navigation
- Supabase session persistence
- Today screen
- Schedule screen
- Progress screen
- Coach scaffold
- Settings scaffold

## Next priorities

1. OAuth login with Apple / Google
2. Native session detail bottom sheet
3. Generate detailed workout from native
4. Push reminders
5. TestFlight build
