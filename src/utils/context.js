// context.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadTopLevelContext() {
    const filePath = path.join(
        __dirname,
        "..",
        "context",
        "index.json",
    );
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (error) {
        console.error(`Error loading top-level context: ${error.message}`);
        throw new Error(`Failed to load top-level context: ${error.message}`);
    }
}

export function loadModelContext(fileName) {
    const filePath = path.join(__dirname, "..", "context", "models", fileName);
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (error) {
        console.error(`Error loading model context: ${error.message}`);
        throw new Error(
            `Failed to load model context for ${fileName}: ${error.message}`,
        );
    }
}
