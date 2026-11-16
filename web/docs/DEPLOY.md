# Deploy the Next.js website

Start on a home network with Node.js 24 and a long-running Next.js process. Use Tailscale Serve for a private test deployment or Cloudflare Tunnel for a hostname you control. The home machine makes the outbound provider and media requests. Use the first host smoke to measure whether that network matches Android. A datacenter VPS is an option once its own smoke shows parity with the Android baseline. Start with 2 vCPU and 2 GB RAM for the process and allow more memory for on-host builds or FFmpeg. [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve) · [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)

Deploy branch `feat/website`. Keep `web/vendor` with the build and run the application from `web/` under a process supervisor with automatic restart.

```sh
cd web
npm ci
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

For a private test, run `tailscale serve --bg http://127.0.0.1:3000` on the host and use its HTTPS tailnet URL from a permitted device. For Cloudflare Tunnel, add a published hostname with `http://127.0.0.1:3000` as the origin service. Keep port 3000 bound to loopback. Use an ingress configuration that preserves Range and avoids caching signed media routes.

Set the production environment through the service manager or managed secret store before starting Next.js. Restrict any local env file to the service account. [Next.js self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting)

| Variable | Configuration |
| --- | --- |
| `K45_REFERENCE_SECRET` | Generate with `openssl rand -hex 32`. Keep it stable across restarts and identical across instances. Rotation invalidates existing signed references and media URLs. |
| `TMDB_API_KEY` | Server-only TMDB credential for Movie Based discovery and details. Use this exact variable name. |
| `K45_TRUSTED_CLIENT_IP_HEADER` | Set to `X-K45-Client-IP` only when trusted ingress overwrites the header. The signed client cookie is used when the variable is unset. |
| `K45MOVIES_API_BASE_URL` | Optional trusted provider API fallback and metadata URL. Defaults to the pinned API source. |
| `K45_PROVIDER_SOURCE` | Leave unset for bundled providers. `api` selects API-only mode for comparison. |
| `K45_KV_REST_URL`, `K45_KV_REST_TOKEN` | Optional shared HTTPS Redis REST provider storage. Supply both, or use process-local TTL storage. |
| `K45_FFMPEG_PATH` | Optional absolute path to an installed full FFmpeg executable. Test availability with `ffmpeg -version` and confirm AAC encoding support. Current compatibility handling copies MKV video into MP4 and encodes audio as AAC. Leave unset to disable. |

For the first Tailscale or Tunnel run, leave `K45_TRUSTED_CLIENT_IP_HEADER` unset unless the ingress explicitly overwrites a trusted header. The signed browser cookie isolates individual limits. If using nginx as the public ingress, keep the Next.js port private and forward Range. If a CDN precedes nginx, configure nginx real-IP handling for its trusted address ranges before using `$remote_addr`. The read timeout applies between upstream reads. [nginx proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-K45-Client-IP $remote_addr;
    proxy_set_header Range $http_range;
    proxy_buffering off;
    proxy_read_timeout 90s;
}
```

Provider requests allow 12 seconds per upstream request and 25 seconds per operation. The shared cache has a 40-second guard. Media upstream connections have a 15-second deadline. Compatibility playback permits two simultaneous FFmpeg conversions per process. Size the proxy timeouts to cover application limits and ongoing playback. Run the initial smoke from a quiet instance and monitor memory and the operation timings before increasing traffic.

```sh
curl -fsS 'https://your-domain.example/api/proxy/providers?op=manifest'
node --import tsx scripts/provider-smoke/run.mts deployed-smoke.json --url 'https://your-domain.example'
```

Use the deployed URL and the same manifest revision, query, and provider IDs as the PC run. A private tailnet URL works from a permitted smoke machine. Keep secrets out of CLI arguments and shared logs. Record the deployment Git SHA, date, network type, and output file with the [provider comparison](PROVIDER_NETWORK_PARITY.md). Compare failures and empty results by operation against [Android ground truth](APP_GROUND_TRUTH.md).

The existing GitHub Pages deployment serves the old demo. Once a Next.js URL passes smoke, the proposed GitHub Pages change is a short notice with a link to that URL. That change needs separate approval.
