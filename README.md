# inopncsw4

## Deployment And Handoff

- Runbook: `docs/DEPLOY_CONTINUITY.md`
- Session log: `docs/SESSION_HANDOFF.md`

## Android App Wrapper

- This repo now includes a Capacitor-based Android wrapper so the app can be installed as a native Android app without relying on Chrome PWA orientation behavior.
- Existing Supabase connections and live data stay the same because the Android app wraps the same built web app from `dist`.

### Commands

- `npm run android:sync`
- `npm run android:open`
- `npm run android:run`

### Build Flow

1. Set the same web env vars used for the current deployment.
2. Install Android Studio and a JDK, then make sure `JAVA_HOME` and the Android SDK path are configured.
3. Run `npm run android:sync`.
4. Run `npm run android:open`.
5. Build the APK or AAB from Android Studio.
