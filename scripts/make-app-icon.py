# Makes the app's icons from the shared DR monogram (scripts/didread_icon.py), so the app icon
# matches the website's favicon: accent green on the warm near-black. Run:
#   python scripts/make-app-icon.py
# It writes:
#   assets/images/icon.png             1024 x 1024, opaque square (iPhone rounds the corners itself)
#   assets/expo.icon/Assets/dr-logo.png the green letters alone, the layer of the iOS 26 layered icon
#   assets/expo.icon/icon.json          that icon's fill: solid near-black
# The new icon shows up in the next EAS build.
import json, os

import didread_icon

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def write(rel, data):
    with open(os.path.join(ROOT, rel), 'wb') as f:
        f.write(data)


write(os.path.join('assets', 'images', 'icon.png'), didread_icon.png(1024, background='square'))
write(os.path.join('assets', 'expo.icon', 'Assets', 'dr-logo.png'), didread_icon.png(1024, background=None))

icon_json = os.path.join(ROOT, 'assets', 'expo.icon', 'icon.json')
with open(icon_json, encoding='utf-8') as f:
    layered = json.load(f)
r, g, b = (int(didread_icon.BG[i:i + 2], 16) / 255 for i in (1, 3, 5))
layered['fill'] = {'solid': f'extended-srgb:{r:.5f},{g:.5f},{b:.5f},1.00000'}
with open(icon_json, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(layered, f, indent=2)
    f.write('\n')
print('made assets/images/icon.png and assets/expo.icon')
