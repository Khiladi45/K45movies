# K45movies Browser Bridge

Extract the ZIP. In Chrome or Edge, open the extensions manager, enable Developer mode, choose **Load unpacked**, and select the extracted directory containing manifest.json. Reload https://khiladi45.github.io/K45movies/ and install a provider from Providers.

The extension packages provider bundles listed in the pinned Khiladi45/K45movies-api manifest. Vega, YouTube, and the moviesApi helper are excluded. It runs those bundles locally and restricts messages to the K45movies GitHub Pages site. Open the Browser Bridge toolbar icon and choose Allow provider access once to approve its HTTPS host permission. The browser codec and media server determine whether a source can play.

From web/, run npm ci and npm run build:extension. The output directory is web/out-extension/. The manifest contains an RSA public key for a stable unpacked extension ID.

Source: https://github.com/Khiladi45/K45movies/tree/feat/website/web/browser-extension
