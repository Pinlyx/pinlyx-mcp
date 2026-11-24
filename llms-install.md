# Installing the Pinlyx MCP server (instructions for AI agents)

Pinlyx is a CRM and unified inbox. There are two ways to connect. Prefer option 1.

## Option 1: remote server (recommended, works on every Pinlyx plan)

Nothing to install. Add a remote MCP server with Streamable HTTP transport:

- Name: `pinlyx`
- URL: `https://api.pinlyx.com/mcp`

Example configuration:

```json
{
  "mcpServers": {
    "pinlyx": {
      "type": "streamableHttp",
      "url": "https://api.pinlyx.com/mcp"
    }
  }
}
```

The server uses OAuth 2.1 with dynamic client registration. On first use the client opens a
Pinlyx sign-in page in the browser; the user signs in (or creates a free account at
https://app.pinlyx.com) and approves the connection. No API key is needed. The Free plan gets
the read-only tools; Pro and above also get the write tools.

If the client does not support OAuth for remote servers, use option 2.

## Option 2: local stdio bridge with an API key

Requires Node.js 18 or newer and a Pinlyx API key (Business plan), created at
https://app.pinlyx.com/settings/developers. Ask the user for the key; never invent one.

```json
{
  "mcpServers": {
    "pinlyx": {
      "command": "npx",
      "args": ["-y", "pinlyx-mcp"],
      "env": { "PINLYX_API_KEY": "<key from the user>" }
    }
  }
}
```

Optional environment variables: `PINLYX_READ_ONLY=true` hides every write tool,
`PINLYX_TOOLS` limits the tool list (comma separated names).

## Check that it works

Call the `crm_whoami` tool. It returns the workspace, the plan and the scopes of this
connection. Then try `crm_list_social_accounts` or `crm_search_contacts`.

Docs: https://docs.pinlyx.com/integrations/mcp/ . Support: support@pinlyx.com
