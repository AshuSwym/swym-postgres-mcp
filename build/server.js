// Use top-level import.meta.url to make this work as an ES module
import { fileURLToPath } from "url";
import path from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();
// Postgres MCP Server
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import pg from "pg";
import { GoogleGenerativeAI } from "@google/generative-ai";
// Access environment variables
const PG_DBNAME = process.env.PG_DBNAME;
const PG_UNAME = process.env.PG_UNAME;
const PG_PASSWD = process.env.PG_PASSWD;
const PG_HOST = process.env.PG_HOST;
const PG_SSL = process.env.PG_SSL === "true";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Ensure you have this in your .env file
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY environment variable not set.");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const server = new Server({
    name: "postgres-gemini-server",
    version: "0.1.0",
}, {
    capabilities: {
        resources: {},
        tools: {
            query: {
                description: "Run a read-only SQL query on the PostgreSQL database.",
                inputSchema: {
                    type: "object",
                    properties: {
                        sql: {
                            type: "string",
                            description: "The SQL query to execute (read-only).",
                        },
                    },
                    required: ["sql"],
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        content: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: "string",
                                    enum: ["text"],
                                },
                                required: ["type"],
                            },
                        },
                        isError: {
                            type: "boolean",
                        },
                    },
                    required: ["content", "isError"],
                },
            },
            ask: {
                description: "Ask a question about the data in the PostgreSQL database using natural language.",
                inputSchema: {
                    type: "object",
                    properties: {
                        question: {
                            type: "string",
                            description: "The natural language question to ask.",
                        },
                    },
                    required: ["question"],
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        content: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: "string",
                                    enum: ["text"],
                                    text: { type: "string" },
                                },
                                required: ["type", "text"],
                            },
                        },
                        isError: {
                            type: "boolean",
                        },
                    },
                    required: ["content", "isError"],
                },
            },
        },
    },
});
// Construct the database URL from environment variables
const databaseUrl = `postgresql://${PG_UNAME}:${PG_PASSWD}@${PG_HOST}/${PG_DBNAME}${PG_SSL ? "?ssl=true" : ""}`;
const resourceBaseUrl = new URL(databaseUrl);
resourceBaseUrl.protocol = "postgres:";
resourceBaseUrl.password = "";
const pool = new pg.Pool({
    connectionString: databaseUrl,
});
const SCHEMA_PATH = "schema";
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const client = await pool.connect();
    try {
        const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        return {
            resources: result.rows.map((row) => ({
                uri: new URL(`${row.table_name}/${SCHEMA_PATH}`, resourceBaseUrl).href,
                mimeType: "application/json",
                name: `"${row.table_name}" database schema`,
            })),
        };
    }
    finally {
        client.release();
    }
});
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resourceUrl = new URL(request.params.uri);
    const pathComponents = resourceUrl.pathname.split("/");
    const schema = pathComponents.pop();
    const tableName = pathComponents.pop();
    if (schema !== SCHEMA_PATH) {
        throw new Error("Invalid resource URI");
    }
    const client = await pool.connect();
    try {
        const result = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [tableName]);
        return {
            contents: [
                {
                    uri: request.params.uri,
                    mimeType: "application/json",
                    text: JSON.stringify(result.rows, null, 2),
                },
            ],
        };
    }
    finally {
        client.release();
    }
});
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "query",
                description: "Run a read-only SQL query",
                inputSchema: {
                    type: "object",
                    properties: {
                        sql: { type: "string" },
                    },
                },
            },
            {
                name: "ask",
                description: "Ask a question about the data.",
                inputSchema: {
                    type: "object",
                    properties: {
                        question: { type: "string" },
                    },
                    required: ["question"],
                },
            },
        ],
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "query") {
        const sql = request.params.arguments?.sql;
        const client = await pool.connect();
        try {
            await client.query("BEGIN TRANSACTION READ ONLY");
            const result = await client.query(sql);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result.rows, null, 2),
                    },
                ],
                isError: false,
            };
        }
        catch (error) {
            return {
                content: [{ type: "text", text: String(error) }],
                isError: true,
            };
        }
        finally {
            client
                .query("ROLLBACK")
                .catch((error) => console.warn("Could not roll back transaction:", error));
            client.release();
        }
    }
    else if (request.params.name === "ask") {
        const question = request.params.arguments?.question;
        const client = await pool.connect();
        try {
            const tableNamesResult = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            const tableNames = tableNamesResult.rows
                .map((row) => row.table_name)
                .join(", ");
            let prompt = `You are a helpful assistant that can answer questions about data in a PostgreSQL database. The database contains the following tables: ${tableNames}. For each table, here is the schema:\n\n`;
            for (const tableName of tableNamesResult.rows) {
                const columnsResult = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [tableName.table_name]);
                prompt += `Table "${tableName.table_name}":\n`;
                columnsResult.rows.forEach((column) => {
                    prompt += `- ${column.column_name} (${column.data_type})\n`;
                });
                prompt += "\n";
            }
            prompt += `Based on this schema, answer the following question: "${question}"\n\nIf the question requires querying the database, please provide the SQL query. If the question can be answered based on the schema information alone, provide a direct answer.\n\n`;
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            return {
                content: [{ type: "text", text: responseText }],
                isError: false,
            };
        }
        catch (error) {
            return {
                content: [{ type: "text", text: String(error) }],
                isError: true,
            };
        }
        finally {
            client.release();
        }
    }
    throw new Error(`Unknown tool: ${request.params.name}`);
});
async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
runServer().catch(console.error);
