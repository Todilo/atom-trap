# Releasing Atom Trap: Neon on Google Play

How the Android app is built and published (ADR-0020). The listing text is in [listing.md](listing.md).

## Once: the upload key

Play signs the app for players with its own key (Play App Signing). We sign each upload with an **upload key**, which lives only on your computer and in the repository's secrets. If it's ever lost, Google can reset it.

1. Install a JDK to get `keytool`, for example:

   ```bash
   winget install EclipseAdoptium.Temurin.21.JDK
   ```

2. Make the key. It asks for a password and your name. Keep the file and password somewhere safe, such as a password manager, and **never commit it**:

   ```bash
   keytool -genkeypair -v -keystore atom-trap-upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000
   ```

3. Add it to the repository's secrets, from the folder with the `.jks` file. GitHub CLI asks for each value, so the passwords don't land in your shell history:

   ```bash
   base64 -w0 atom-trap-upload.jks | gh secret set ANDROID_KEYSTORE_BASE64 --repo Todilo/atom-trap
   ```

   ```bash
   gh secret set ANDROID_KEYSTORE_PASSWORD --repo Todilo/atom-trap
   ```

   ```bash
   gh secret set ANDROID_KEY_PASSWORD --repo Todilo/atom-trap
   ```

   ```bash
   gh secret set ANDROID_KEY_ALIAS --repo Todilo/atom-trap --body upload
   ```

   With a PKCS12 keystore (keytool's default), the key password is the same as the keystore password.

## Each release

1. Run **Android app** from the repository's Actions tab, or push a tag:

   ```bash
   git tag v1.0.0 && git push origin v1.0.0
   ```

2. Download the run's artifact. It holds:
   - `app-release.aab`, the bundle to upload to Play;
   - `app-debug.apk`, to install on a phone by hand and try first.

3. In Play Console, upload the `.aab` to a testing track (Closed testing for the first release), then promote it to Production when it's ready.

Every run gets a higher version code (the run number), which Play requires for each upload. The version name comes from `package.json`, so raise `version` there for a release players should notice.

## The first release, in Play Console

1. Create the developer account (one-off fee, ID verification).
2. Create the app: name *Atom Trap: Neon*, game, free.
3. Fill in *App content* and the store listing from [listing.md](listing.md), with the graphics in this folder.
4. Upload the first `.aab` to **Closed testing**. New personal developer accounts must run a closed test with at least 12 testers for 14 days before they can publish to Production. Organization accounts skip this.
5. Apply for Production access, then promote the release.

## Store graphics

`npm run store-capture` remakes `screenshots/` and `feature-graphic.png` from the running game: it starts the dev server and a headless Edge or Chrome, plays a few boards with the bot and takes the pictures. The feature graphic is drawn by `feature-graphic.html`.
