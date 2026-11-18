// The Privacy Policy link (Welcome's fine print and Settings): the policy hosted at didread.app
// (site/privacy/index.html, from docs/PRIVACY.md). Opens in a Safari sheet inside the app.
import * as WebBrowser from 'expo-web-browser';

import { colors } from '@/theme';

export const PRIVACY_POLICY_URL = 'https://didread.app/privacy';

export function openPrivacyPolicy() {
  WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL, {
    controlsColor: colors.text,
    toolbarColor: colors.background,
    dismissButtonStyle: 'done',
  }).catch(() => {});
}
