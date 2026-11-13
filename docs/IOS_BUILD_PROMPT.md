# iOS build prompt

Paste everything below the line into Claude Code on a Mac that has Xcode installed.

---

I want you to build and release the iOS version of **Marsh Raid**, a Capacitor-wrapped HTML5 game. Work autonomously; only stop for things that need my Apple ID or password.

**Repo:** https://github.com/gremstard/marsh-raid

1. Run `gh auth status`. If the signed-in GitHub account is `gremstard`, clone the repo directly. If it is a different account, fork it first with `gh repo fork gremstard/marsh-raid --clone` and work in the fork. Tell me which case applied.
2. In the repo: `npm install`, then `npm run build` (produces `dist/index.html`), then `npx cap sync ios`. The iOS project is already committed under `ios/`, with the app icon, splash, hidden status bar and full-screen flags set. Bundle id is `com.gremstard.marshraid`, display name "Marsh Raid".
3. Check Xcode is selected (`xcode-select -p` should point at `/Applications/Xcode.app/Contents/Developer`; if not, tell me the `sudo xcode-select -s ...` command to run) and that the iOS platform is installed.
4. Build and run on an iOS Simulator first (iPhone, landscape and portrait both work) to confirm it launches, the hub shows, and a raid starts when you tap DEPLOY. Fix anything broken in `ios/` and commit it.
5. For a device/TestFlight build: open `ios/App/App.xcworkspace` in Xcode, set my signing team under Signing & Capabilities (ask me for the team if it is not already configured), then archive with `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release -archivePath build/MarshRaid.xcarchive archive` and export an `.ipa` with an export options plist (ad-hoc or app-store method, ask me which). If signing is not possible on this machine, produce an unsigned `.xcarchive` zip instead and say so clearly.
6. Create or update the GitHub release tagged `v0.1.0` on the repo you are working in (`gh release create v0.1.0 --title "Marsh Raid 0.1.0" --notes "..."` or `gh release upload v0.1.0 ...`) and attach the `.ipa` (or archive zip). Also attach `dist/index.html` as the standalone browser build if it is not already attached.
7. Commit any changes you made to `ios/` and push. If you worked in a fork, open a pull request against `gremstard/marsh-raid` with the iOS fixes.

Report at the end: which account/repo you used, the simulator result, the release URL, and anything that needs my Apple developer account to finish.
