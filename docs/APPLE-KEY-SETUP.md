# Apple token cleanup: creating the Sign in with Apple key

When someone deletes their DidRead account, DidRead also asks Apple to remove DidRead's access to their Apple ID (App Review checks for this). To do that, the `delete-account` backend function needs a **Sign in with Apple key** from your Apple Developer account. The key lives **only in Supabase secrets**: never in the app, never in the DidRead folder, never in git, and never pasted into a chat.

Until the key is added, deleting an account still works; it just skips the Apple clean-up.

## Part 1: create the key (Apple Developer website)

1. On your PC, open https://developer.apple.com/account and sign in.
2. Find your **Team ID**: on the account page, scroll to **Membership details**. It's 10 letters and numbers (for example `AB12CD34EF`). Write it down; it isn't secret.
3. Click **Certificates, Identifiers & Profiles**, then **Keys** in the left list.
4. Click the blue **+** next to "Keys".
5. **Key Name:** type `DidRead Sign in with Apple`.
6. Tick **Sign in with Apple**, then click **Configure** on that row.
7. **Primary App ID:** choose **DidRead (com.didread.app)**. Click **Save**.
8. Click **Continue**, then **Register**. (If it asks for a description, type: `Revokes Sign in with Apple when a user deletes their DidRead account`.)
9. Click **Download**. **You can only download it once**, so keep the file. It's named like `AuthKey_XYZ123ABCD.p8` and lands in your Downloads folder.
10. Note the **Key ID**: it's on that page, and it's also the part of the file name between `AuthKey_` and `.p8` (10 characters). Not secret.

Keep the `.p8` file somewhere private **outside** the DidRead folder (OneDrive syncs that folder). A password manager is a good home for it. If it's ever lost or leaked, revoke it on the same Keys page and make a new one.

## Part 2: add 4 secrets in Supabase

1. Open https://supabase.com/dashboard and choose the DidRead project.
2. In the left sidebar click **Edge Functions**, then **Secrets**.
3. Add these four, each with **Add new secret** (the name exactly as written, in capitals):

| Name | Value |
| --- | --- |
| `APPLE_TEAM_ID` | your Team ID from step 2 |
| `APPLE_KEY_ID` | the Key ID from step 10 |
| `APPLE_CLIENT_ID` | `com.didread.app` |
| `APPLE_PRIVATE_KEY` | the whole `.p8` file (see below) |

For `APPLE_PRIVATE_KEY`: right-click the `.p8` file → **Open with** → **Notepad**. Press **Ctrl+A**, then **Ctrl+C**, and paste it as the value. It starts with `-----BEGIN PRIVATE KEY-----` and ends with `-----END PRIVATE KEY-----`; include those lines. Close Notepad without saving.

4. Click **Save** (or **Bulk save**).
5. Tell Claude Code "the Apple secrets are in", and it deploys the updated `delete-account` function:

```bash
npx supabase functions deploy delete-account --project-ref qacimrcquxlwowqtafys --use-api --no-verify-jwt
```

## Part 3: check it (optional; it deletes that account)

Only do this with an account you're happy to lose. It deletes that account's progress for good.

1. In the DidRead development app, sign in with Apple.
2. Settings → **Delete account** → **Delete forever**. Apple's sheet appears once more: confirm with Face ID. (Closing the sheet instead deletes nothing.)
3. Welcome says the account is deleted.
4. On the iPhone: **Settings → [your name] → Sign in with Apple** (on some iOS versions **Password & Security → Sign in with Apple**). DidRead should no longer be listed.
5. In Supabase: **Edge Functions → delete-account → Logs** shows `Apple cleanup revoked`.
