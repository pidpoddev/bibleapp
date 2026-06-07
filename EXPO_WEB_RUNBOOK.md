# Expo Web Runbook

## Canonical remote start

Use this command whenever the server is relaunched for browser plus Expo Go testing through the TP-Link route:

```bash
npm run web:remote
```

Do not use plain `npm run web` for remote Expo Go testing. Plain web mode keeps the web app on port `8081`, but Expo may advertise a LAN IP to Expo Go and may prompt for `Log in` / `Proceed anonymously`.

The `web:remote` script must keep these settings:

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=rcdl.tplinkdns.com EXPO_NO_TELEMETRY=1 BROWSER=none expo start --web --port 8081 --offline
```

- `REACT_NATIVE_PACKAGER_HOSTNAME=rcdl.tplinkdns.com` keeps the QR, manifest, bundle, and Metro traffic on the public hostname.
- `--port 8081` keeps web and Expo Go on the same expected port.
- `--offline` uses anonymous manifest signatures and prevents Expo CLI from pausing on the login prompt.
- `BROWSER=none` prevents Expo from opening its own browser window.

## Local web service

Run the web app on a fixed port:

```bash
npm run web
```

The `web` script is pinned to port `8081`:

```bash
expo start --web --port 8081
```

Local browser URL:

```text
http://localhost:8081/
```

Keep this process running while testing. If the app is rebuilt or restarted for local browser-only testing, use the same command so the route remains stable on port `8081`.

For remote testing with Expo Go, prefer the public-hostname command:

```bash
npm run web:remote
```

That command keeps the same port, sets `REACT_NATIVE_PACKAGER_HOSTNAME=rcdl.tplinkdns.com`, and starts Expo with `--offline`. The hostname setting makes Expo advertise the public DNS name instead of a local LAN IP. The offline flag makes Expo use anonymous manifest signatures, which avoids the `Log in` / `Proceed anonymously` prompt when Expo Go opens the project.

## Static or external route

If you create an external route, point it at the machine running Expo on:

```text
http://<host>:8081/
```

For browser testing from outside the local machine, the route must support normal HTTP traffic and the development server's live reload connections. A reverse proxy or tunnel should forward WebSocket upgrade traffic as well as regular HTTP requests.

## Expo Go

Expo Go does not use the web URL as a static website. It loads the native Expo development bundle from the Metro dev server.

For Expo Go on the same network, port `8081` is usually the important port because Metro advertises an `exp://<host>:8081` URL. The phone must be able to reach that host and port.

For the TP-Link route, scan or enter:

```text
exp://rcdl.tplinkdns.com:8081
```

If you want to use Expo Go from anywhere, a plain static web route is not enough. Use one of these instead:

- Expo tunnel mode, if available for your setup.
- A public route that forwards the Metro server traffic on `8081`, including WebSocket traffic.
- A development build or production build for more reliable remote testing.

For simple browser access from anywhere, exposing the web app on port `8081` is enough. For Expo Go, expect to keep Metro reachable on `8081` using the `exp://` URL, not just an `https://` webpage.
