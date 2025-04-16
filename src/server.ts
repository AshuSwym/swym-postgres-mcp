import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const NWS_API_BASE = "https://localhost:5000/swym-mcp";
const USER_AGENT = "swym-mcp/1.0";

// Create server instance
const server = new McpServer({
    name: "swym-mcp",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
});

export default server;
