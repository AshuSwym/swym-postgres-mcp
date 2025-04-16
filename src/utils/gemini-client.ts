// gemini-client.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

// Check if the API key is available
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(apiKey);

// Define interfaces for table context
interface TableField {
    name: string;
    type: string;
    description: string;
}

interface TableContext {
    tableName: string;
    fields: TableField[];
}

interface TableInfo {
    tableName: string;
    fileName: string;
    description: string;
}

export async function selectRelevantTable(nlq: string, topLevelContext: TableInfo[]): Promise<TableInfo | null> {
    const prompt = `
You are a Postgres data expert.

Given the following user query:

"${nlq}"

And the list of available tables:

${JSON.stringify(topLevelContext, null, 2)}

Pick the **one best matching table**. Return only the JSON object of the best matching table. If none match, return null.
`;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    try {
        return JSON.parse(text);
    } catch (error) {
        console.error("Failed to parse Gemini response as JSON:", error);
        return null;
    }
}

export async function generateSQLQuery(nlq: string, tableContext: TableContext): Promise<string> {
    const prompt = `
You are a SQL expert.

Given this table schema:

${JSON.stringify(tableContext.fields, null, 2)}

Translate the following natural language into a valid **PostgreSQL** query:

"${nlq}"

Return only the SQL query.
`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("Error generating SQL query:", error);
        throw new Error("Failed to generate SQL query: " + (error as Error).message);
    }
}
