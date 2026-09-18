# Changelog

All notable changes to the Pinlyx MCP server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `ads` group for `--tools` / `CRMSOLID_TOOLS`, covering the Google Ads tools
  (`crm_google_ads_*`, `crm_list_google_ads_accounts`, ad drafts). It is matched before
  `analytics` so `crm_google_ads_summary` lands in the right group.

### Changed

- Documentation reflects the hosted server as it stands: 76 tools (44 read-only, 32 write),
  21 resources and 15 prompts. The email family now includes mailbox connection
  (`crm_list_email_accounts`, `crm_add_email_account`, `crm_test_email_account`), and the
  Google Ads family is listed. Nothing in the bridge changed for these; the tool list comes
  from the server at runtime.

## [0.1.4] - 2026-09-16

### Changed

- The product is now **Pinlyx**. The server title reported to clients, the messages the
  server returns and the package metadata carry the new name, and the links point at
  pinlyx.com, docs.pinlyx.com and github.com/Pinlyx/pinlyx-mcp.
- Nothing on the wire changed. The package name `@crmsolid/mcp-server`, the
  `crmsolid-mcp` binary, the `CRMSOLID_*` environment variables, the server name
  `crmsolid` and `api.crmsolid.com` are all unchanged, so existing client
  configurations keep working untouched.

## [0.1.0] - 2026-08-24

First release. A stdio Model Context Protocol server that connects an MCP client
(Claude Desktop, Claude Code, Cursor, ChatGPT, or anything else that speaks MCP) to a
Pinlyx workspace, so social media direct messages and scheduled posts can be managed
from an assistant.

### Added

- **`crmsolid-mcp` binary**, published as `@crmsolid/mcp-server` and designed to be run
  with `npx -y @crmsolid/mcp-server`. Speaks stdio MCP (rev 2025-06-18) locally and
  proxies to `POST https://api.crmsolid.com/mcp` over the same `csk_live_…` bearer key as
  the REST API.
- **Full method mirror**: `tools/list`, `tools/call`, `resources/list`, `resources/read`,
  `prompts/list`, `prompts/get`, `ping` and `logging/setLevel`. Payloads are forwarded
  verbatim in both directions, because the MCP surface is camelCase natively and renaming
  anything would corrupt it.
- **Session handling** per Streamable HTTP: `initialize` once, keep the `Mcp-Session-Id`
  the server mints, send it on every later call, and `DELETE /mcp` on shutdown. The
  handshake is deferred to the first real request, so a client that connects and asks
  nothing never burns an API call.
- **`--tools <groups>`**, a comma-separated filter over tool groups
  (`social`, `posts`, `contacts`, `conversations`, `deals`, `tasks`, `email`, `finance`,
  `sequences`, `pipelines`, `webhooks`, `jobs`, `agents`, `accounts`, `telegram`,
  `twitter`, `analytics`). Groups are inferred from tool names by rule, so tools the API
  adds later are classified rather than dropped.
- **`--read-only`**, which exposes only tools Pinlyx annotates `readOnlyHint` and
  refuses a write even when one is called by name. Both filters are enforced on the call
  path, not only in the listings: hiding a tool is advice, refusing the call is the gate.
- **Actionable errors.** A rejected key, a missing scope, a plan-gated feature, a rate
  limit and a network failure each produce their own sentence naming the fix. A missing
  scope names the scope to add and the scopes the key already has, taken from the
  backend's `-32002` payload.
- **Retry with backoff** on 429, 408 and 5xx and on transport failures, honouring
  `Retry-After` then `X-RateLimit-Reset`, with exponential backoff and full jitter. Only
  idempotent calls are retried. `tools/call` never is: a retried send is a second message
  to a real person.
- **Secret redaction** on every output path. The API key is scrubbed from error messages,
  debug logging and anything returned to the client, by shape and by exact value.
- **Notification relay.** The upstream Server-Sent Events channel is read in the
  background and `notifications/progress`, `notifications/message` and the list-changed
  family are relayed to the local client. A progress token supplied by the client is
  passed through so the backend addresses its updates correctly. A tool list that changes
  upstream invalidates the cached annotations the read-only gate reads.
- **`--help` and `--version`** work with no key and no network, and nothing but a
  JSON-RPC frame is ever written to stdout.
- Configuration through flags or environment (`CRMSOLID_API_KEY`, `CRMSOLID_BASE_URL`,
  `CRMSOLID_TOOLS`, `CRMSOLID_READ_ONLY`, `CRMSOLID_TIMEOUT_MS`, `CRMSOLID_MAX_RETRIES`,
  `CRMSOLID_SSE`, `CRMSOLID_DEBUG`), with the flag winning where both are set.
- **Library entry point** (`@crmsolid/mcp-server`, ESM and CJS with types) exposing
  `Bridge`, `UpstreamClient`, the filters and the error classes, for hosts that embed the
  bridge instead of spawning it.

### Notes

- Requires Node 20 or newer, for global `fetch`, `ReadableStream` and `AbortSignal`.
- An unknown tool group passed to `--tools` is rejected at startup rather than silently
  producing an empty tool list.
- A base URL is normalized: a missing scheme, a trailing slash and a pasted `/mcp` suffix
  are all accepted.
