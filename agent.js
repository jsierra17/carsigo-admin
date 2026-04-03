import axios from "axios";
import fs from "fs-extra";
import readlineSync from "readline-sync";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.DEEPSEEK_API_KEY;

async function askDeepSeek(prompt) {
  const res = await axios.post(
    "https://api.deepseek.com/chat/completions",
    {
      model: "deepseek-coder",
      messages: [
        { role: "system", content: "You are a senior software engineer." },
        { role: "user", content: prompt }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return res.data.choices[0].message.content;
}

async function readProject() {
  const files = await fs.readdir(".");
  return files.join("\n");
}

async function main() {
  console.log("🤖 DeepSeek Agent iniciado\n");

  while (true) {
    const input = readlineSync.question(">> ");

    if (input === "exit") break;

    const projectFiles = await readProject();

    const prompt = `
Proyecto:
${projectFiles}

Tarea:
${input}
    `;

    const response = await askDeepSeek(prompt);

    console.log("\n💡 Respuesta:\n");
    console.log(response);
  }
}

main();