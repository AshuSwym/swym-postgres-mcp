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
import {
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import pg from "pg";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { any, string } from "zod";

// Access environment variables
const PG_DBNAME = process.env.PG_DBNAME;
const PG_UNAME = process.env.PG_UNAME;
const PG_PASSWD = process.env.PG_PASSWD;
const PG_HOST = process.env.PG_HOST;
const PG_SSL = process.env.PG_SSL === "true";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY environment variable not set.");
    process.exit(1);
}
if (!SLACK_WEBHOOK_URL) {
    console.error("SLACK_WEBHOOK_URL environment variable not set.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Better for reasoning and long context

const server = new Server(
    {
        name: "postgres-gemini-server",
        version: "0.2.0",
    },
    {
        capabilities: {
            resources: {},
            tools: {
                generate_sql: {
                    description:
                        "Generate a read-only SQL query from a natural language prompt using schema-aware reasoning.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            question: {
                                type: "string",
                                description: "Natural language question",
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
                                        type: {
                                            type: "string",
                                            enum: ["text"],
                                        },
                                        text: { type: "string" },
                                    },
                                    required: ["type", "text"],
                                },
                            },
                            isError: { type: "boolean" },
                        },
                        required: ["content", "isError"],
                    },
                },
                query_sql: {
                    description: "Run a read-only SQL query",
                    inputSchema: {
                        type: "object",
                        properties: {
                            sql: { type: "string" },
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
                                        type: {
                                            type: "string",
                                            enum: ["text"],
                                        },
                                        text: { type: "string" },
                                    },
                                    required: ["type", "text"],
                                },
                            },
                            isError: { type: "boolean" },
                        },
                        required: ["content", "isError"],
                    },
                },
                call_config_api: {
                    description:
                        "Call Swym internal API to fetch backend config for a merchant",
                    inputSchema: {
                        type: "object",
                        properties: {
                            merchant_pid: {
                                type: "string",
                                description:
                                    "The Swym merchant PID (e.g., abc123)",
                            },
                        },
                        required: ["merchant_pid"],
                    },
                    outputSchema: {
                        type: "object",
                        properties: {
                            content: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        type: {
                                            type: "string",
                                            enum: ["text"],
                                        },
                                        text: { type: "string" },
                                    },
                                    required: ["type", "text"],
                                },
                            },
                            isError: { type: "boolean" },
                        },
                        required: ["content", "isError"],
                    },
                },
                send_slack_alert: {
                    description: "Send an alert to Slack with a given message.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            message: {
                                type: "string",
                                description: "The message to post to Slack.",
                            },
                        },
                        required: ["message"],
                    },
                    outputSchema: {
                        type: "object",
                        properties: {
                            content: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        type: {
                                            type: "string",
                                            enum: ["text"],
                                        },
                                        text: { type: "string" },
                                    },
                                    required: ["type", "text"],
                                },
                            },
                            isError: { type: "boolean" },
                        },
                        required: ["content", "isError"],
                    },
                }
            },
        },
    },
);

// DB connection
const databaseUrl = `postgresql://${PG_UNAME}:${PG_PASSWD}@${PG_HOST}/${PG_DBNAME}${PG_SSL ? "?ssl=true" : ""}`;
const resourceBaseUrl = new URL(databaseUrl);
resourceBaseUrl.protocol = "postgres:";
resourceBaseUrl.password = "";

const pool = new pg.Pool({ connectionString: databaseUrl });

const SCHEMA_PATH = "schema";

// ===============================
// MCP RESOURCE: list table schemas
// ===============================
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'swymbi'",
        );
        return {
            resources: result.rows.map((row) => ({
                uri: new URL(
                    `${row.table_name}/${SCHEMA_PATH}`,
                    resourceBaseUrl,
                ).href,
                mimeType: "application/json",
                name: `"${row.table_name}" database schema`,
            })),
        };
    } finally {
        client.release();
    }
});

// ===============================
// MCP RESOURCE: read a schema
// ===============================
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resourceUrl = new URL(request.params.uri);
    const pathComponents = resourceUrl.pathname.split("/");
    const schema = pathComponents.pop();
    const tableName = pathComponents.pop();

    if (schema !== SCHEMA_PATH) throw new Error("Invalid resource URI");

    const client = await pool.connect();
    try {
        const result = await client.query(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
            [tableName],
        );

        return {
            contents: [
                {
                    uri: request.params.uri,
                    mimeType: "application/json",
                    text: JSON.stringify(result.rows, null, 2),
                },
            ],
        };
    } finally {
        client.release();
    }
});

// ===============================
// MCP RESOURCE: get first 5 rows of all tables in the schema
// ===============================
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resourceUrl = new URL(request.params.uri);
    const pathComponents = resourceUrl.pathname.split("/");
    const schema = pathComponents.pop();

    if (schema !== "rows") throw new Error("Invalid resource URI");

    const client = await pool.connect();
    try {
        // Fetch all table names in the schema
        const tablesResult = await client.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'swymbi'"
        );
        const tables = tablesResult.rows.map((row) => row.table_name);

        const tableData: any = {};
        for (const tableName of tables) {
            const result = await client.query(`SELECT * FROM ${tableName} LIMIT 5`);
            tableData[tableName] = result.rows;
        }

        return {
            contents: [
                {
                    uri: request.params.uri,
                    mimeType: "application/json",
                    text: JSON.stringify(tableData, null, 2),
                },
            ],
        };
    } finally {
        client.release();
    }
});

// ===============================
// TOOL: list tools
// ===============================
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "generate_sql",
                description: "Generate a SQL query from natural language",
                inputSchema: {
                    type: "object",
                    properties: {
                        question: { type: "string" },
                    },
                    required: ["question"],
                },
            },
            {
                name: "query_sql",
                description: "Execute a read-only SQL query",
                inputSchema: {
                    type: "object",
                    properties: {
                        sql: { type: "string" },
                    },
                    required: ["sql"],
                },
            },
            {
                name: "call_config_api",
                description:
                    "Call Swym internal API to fetch backend config for a merchant",
                inputSchema: {
                    type: "object",
                    properties: {
                        merchant_pid: {
                            type: "string",
                            description: "The Swym merchant PID (e.g., abc123)",
                        },
                    },
                    required: ["merchant_pid"],
                },
            },
            {
                name: "send_slack_alert",
                description: "Send an alert to Slack with a given message.",
                inputSchema: {
                    type: "object",
                    properties: {
                        message: {
                            type: "string",
                            description: "The message to post to Slack.",
                        },
                    },
                    required: ["message"],
                },
            },
        ],
    };
});

// ===============================
// TOOL: tool logic
// ===============================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    if (name === "generate_sql") {
        const question = request.params.arguments?.question as string;

        const client = await pool.connect();
        try {
            // Collect schema for all public tables
            const tableNamesRes = await client.query(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
            );
            const tableNames = tableNamesRes.rows.map((r) => r.table_name);

            let prompt = `Generate a read-only SQL query based on the following question: "${question}".\n\n`;
            prompt += "Here are the relevant table schemas:\n\n";

            for (const table of tableNames) {
                const cols = await client.query(
                    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
                    [table],
                );
                prompt += `Table "${table}":\n`;
                cols.rows.forEach((c) => {
                    prompt += `- ${c.column_name} (${c.data_type})\n`;
                });
                prompt += "\n";
            }

            prompt += "Only use SELECT statements. Do not modify data.";

            const result = await model.generateContent(prompt);
            const sql = result.response.text();

            return {
                content: [{ type: "text", text: sql }],
                isError: false,
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: String(error) }],
                isError: true,
            };
        } finally {
            client.release();
        }
    }

    if (name === "query_sql") {
        const sql = request.params.arguments?.sql as string;
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
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
        } catch (error) {
            return {
                content: [{ type: "text", text: String(error) }],
                isError: true,
            };
        } finally {
            client.query("ROLLBACK").catch(() => {});
            client.release();
        }
    }

    if (name === "call_config_api") {
        const { merchant_pid } = request.params.arguments as {
            merchant_pid: string;
        };

        const apiUrl = `https://dashboard-dev.internalswym.com/intersvc/merchant/configs/backend?pid=${merchant_pid}`;
        try {
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "x-swym-hmac-sha256": "12345",
                    "x-swym-rchl": "12345",
                    "x-swym-src": "swym-install",
                },
            });

            const data = await response.json();

            return {
                content: [
                    { type: "text", text: JSON.stringify(data, null, 2) },
                ],
                isError: false,
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: String(error) }],
                isError: true,
            };
        }
    }

    if (name === "send_slack_alert") {
        const { message } = request.params.arguments as { message: string };

        try {
            const response = await fetch(SLACK_WEBHOOK_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ text: message }),
            });

            if (!response.ok) {
                throw new Error(`Slack responded with ${response.status}`);
            }

            return {
                content: [
                    { type: "text", text: "Slack alert sent successfully ✅" },
                ],
                isError: false,
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: String(error) }],
                isError: true,
            };
        }
    }

    throw new Error(`Unknown tool: ${name}`);
});

async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

runServer().catch(console.error);
