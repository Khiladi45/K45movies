# Deploy the Next.js website

Use a Linux VPS in a datacenter with Node.js 24, HTTPS ingress, and a long-running Next.js process. Start with 2 vCPU and 2 GB RAM for the process and allow more memory for on-host builds or FFmpeg. Treat these as starting allocations. Observe process RSS, media bandwidth, provider deadline errors, and FFmpeg CPU load on the deployed instance. GitHub Pages can serve static assets. The public GitHub Pages URL returned HTTP 404 on the provider API during Phase 5.

Deploy branch `feat/website`. Keep `web/vendor` with the build and run the application from `web/` under a process supervisor with automatic restart.

```sh
cd web
npm ci
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

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

Expose nginx on HTTPS and keep the Next.js port private. This example assumes nginx is the public ingress. If a CDN precedes nginx, configure the real-IP module for the CDN's trusted address ranges before using `$remote_addr`. Forward the request headers, including Range, and disable response buffering for streaming. The read timeout applies between upstream reads. [nginx proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)

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

Use the deployed public URL and the same provider manifest revision for comparison. Provider calls run on the target server, so the requests to third-party providers originate from the datacenter. Keep secrets out of CLI arguments and shared logs. Record the deployment Git SHA, date, region, and output file with the local comparison.
