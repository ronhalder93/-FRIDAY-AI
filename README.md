# FRIDAY AI

An independent AI workspace with a chat interface and image studio.

## Deploy on Render

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Health/status endpoint: `/api/status`

## Environment variables

- `OPENAI_API_KEY`: optional server-side key for chat. Never put this in frontend code or commit it.
- `OPENAI_MODEL`: optional chat model override (defaults to `gpt-4o-mini`).
- `GPU_WORKER_URL`: optional base URL for a separate GPU image worker. The worker must accept multipart `POST /generate` and return JSON containing `image_url` or `image_base64`.
- `GPU_WORKER_TOKEN`: optional bearer token for the GPU worker.

## GPU note

Render web services in this setup host the UI/API, not the image model. Heavy downloaded image models need a separate GPU host. FRIDAY AI proxies image requests to that worker when configured.

## Local run

```bash
npm install
npm start
```
Open http://localhost:3000.
