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


## AI providers

FRIDAY AI supports two selectable providers in the interface:

- **OpenRouter Free** for chat (model defaults to `openrouter/free`) and OpenRouter image generation.
- **Civitai** for chat and image workflows through the official Orchestration API.

Set these secrets in Render → Environment (never commit API tokens):

- `CIVITAI_API_TOKEN`: Civitai API key. The server also recognizes the legacy names `CIVITAI_TOKEN` and `CIVITAI_API_KEY`.
- `CIVITAI_CHAT_MODEL`: optional Civitai AIR model URN. Defaults to the documented Qwen3.6 model URN.
- `CIVITAI_IMAGE_MODEL`: optional Civitai AIR checkpoint URN. Defaults to the documented SD1 checkpoint example.
- `CIVITAI_IMAGE_ENGINE`: optional image engine (defaults to `sdcpp`).
- `CIVITAI_IMAGE_ECOSYSTEM`: optional model ecosystem (defaults to `sd1`).

Civitai generation uses Civitai account credits/limits and is not guaranteed to be free or unlimited. The first Civitai image route does not yet accept reference-image uploads; use OpenRouter for reference-guided generation. Select the provider separately in Chat and Image Studio.
