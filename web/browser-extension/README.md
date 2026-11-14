# K45movies Browser Bridge

Extract the ZIP. In Chrome or Edge, open the extensions manager, enable Developer mode, choose **Load unpacked**, and select the extracted directory containing manifest.json. Reload https://khiladi45.github.io/K45movies/ and install a provider from Providers.

The extension packages a pinned revision of provider bundles from K45movies-api. It runs those bundles locally and restricts messages to the K45movies GitHub Pages site. If a request uses another HTTPS host, approve it through the extension icon and retry. The browser codec and media server determine whether a source can play.

From web/, run npm ci and npm run build:extension. The output directory is web/out-extension/. The manifest contains an RSA public key for a stable unpacked extension ID.

Source: https://github.com/Khiladi45/K45movies/tree/feat/website/web/browser-extension
