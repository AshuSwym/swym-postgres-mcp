// Use top-level import.meta.url to make this work as an ES module
import { fileURLToPath } from "url";
import path from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the MCP SDK
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Import utility functions
import { loadTopLevelContext, loadModelContext } from "./utils/context.js";
import {
    selectRelevantTable,
    generateSQLQuery,
} from "./utils/gemini-client.js";

// Define the schemas for our tool
const QueryToolRequestSchema = z.object({
    method: z.literal("tools/query"),
    params: z.object({
        nlq: z
            .string()
            .describe("Natural language query to be converted into SQL."),
    }),
});

type QueryToolRequest = z.infer<typeof QueryToolRequestSchema>;

const QueryToolResponseSchema = z.object({
    table: z.string(),
    query: z.string(),
});

// Create a new MCP server
const server = new McpServer({
    name: "swym-postgres-mcp",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
});

// Register the query tool
server.tool({
    name: "query",
    description:
        "Process a natural language query and return the corresponding SQL query.",
    args: {
        nlq: {
            type: "string",
            description: "Natural language query to be converted into SQL.",
        },
    },
    handler: async ({ nlq }) => {
        const topLevelContext = loadTopLevelContext();
        const selectedTable = await selectRelevantTable(nlq, topLevelContext);

        if (!selectedTable) {
            throw new Error("No relevant table found for the given query.");
        }

        const modelContext = loadModelContext(selectedTable.fileName);
        const sqlQuery = await generateSQLQuery(nlq, modelContext);

        return {
            table: selectedTable.tableName,
            query: sqlQuery,
        };
    },
});

// Start the server with stdio transport
server.listen(() => {
    console.log("✅ MCP server is running");
});
