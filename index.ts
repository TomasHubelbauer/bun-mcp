import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { file, write } from "bun";
import { createServer } from "http";

if (!process.argv[2]) {
  throw new Error(
    'Register the MCP server with `args` set to `["${workspaceFolder}", "${workspaceFolder}"]`.'
  );
}

process.chdir(process.argv[2]);

const mcpServer = new McpServer({
  name: "to-do",
  version: "0.0.0",
  capabilities: {
    tools: {},
  },
});

const FILE_NAME = "TODO.md";

async function readTodos() {
  const text = (await file(FILE_NAME).exists())
    ? await file(FILE_NAME).text()
    : "";

  const lines = text.split("\n").filter((line) => line.trim() !== "");
  return lines.map((line) => {
    const isChecked = line.startsWith("- [x] ");
    const name = line.slice("- [?] ".length).trim();
    return { name, isChecked };
  });
}

async function writeTodos(todos: Awaited<ReturnType<typeof readTodos>>) {
  const content = todos
    .map((todo) => `- [${todo.isChecked ? "x" : " "}] ${todo.name}`)
    .join("\n");
  await write(FILE_NAME, content);
}

mcpServer.tool(
  "list-todos",
  "Lists all to-do items in the TODO.md file",
  async () => {
    const todos = await readTodos();

    return {
      content: [
        {
          type: "text",
          text: todos
            .map((todo) => `${todo.isChecked ? "✅" : "❎"} ${todo.name}`)
            .join("\n"),
        },
      ],
    };
  }
);

mcpServer.tool(
  "add-todo",
  "Adds a new to-do item to the TODO.md file",
  {
    name: z.string().describe("The name of the to-do item"),
  },
  async ({ name }) => {
    const todos = await readTodos();
    const newTodo = { name, isChecked: false };
    todos.push(newTodo);
    await writeTodos(todos);

    return {
      content: [
        {
          type: "text",
          text: `Added new to-do item: ${newTodo.name} to ${process.cwd()}`,
        },
      ],
    };
  }
);

mcpServer.tool(
  "toggle-todo",
  "Toggles the completion status of a to-do item",
  {
    keyword: z
      .string()
      .describe("A keyword in the name of the to-do item to toggle"),
  },
  async ({ keyword }) => {
    const todos = await readTodos();
    const todo = todos.find((todo) => todo.name.includes(keyword));
    if (!todo) {
      return {
        content: [
          {
            type: "text",
            text: `To-do item containing "${keyword}" not found.`,
          },
        ],
      };
    }

    todo.isChecked = !todo.isChecked;
    await writeTodos(todos);

    return {
      content: [
        {
          type: "text",
          text: `Toggled to-do item "${todo.name}" to ${
            todo.isChecked ? "completed" : "not completed"
          }.`,
        },
      ],
    };
  }
);

mcpServer.tool(
  "remove-todo",
  "Removes a to-do item from the TODO.md file",
  {
    keyword: z
      .string()
      .describe("A keyword in the name of the to-do item to remove"),
  },
  async ({ keyword }) => {
    const todos = await readTodos();
    const index = todos.findIndex((todo) => todo.name.includes(keyword));
    if (index === -1) {
      return {
        content: [
          {
            type: "text",
            text: `To-do item containing "${keyword}" not found.`,
          },
        ],
      };
    }

    const removedTodo = todos.splice(index, 1)[0];
    await writeTodos(todos);

    return {
      content: [
        {
          type: "text",
          text: `Removed to-do item "${removedTodo.name}".`,
        },
      ],
    };
  }
);

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

await mcpServer.connect(transport);

// Note that `Bun.serve` cannot be used here as its `request` and `response`
// types are not compatible with the MCP server transport.
const httpServer = createServer(async (request, response) => {
  if (request.method !== "POST") {
    response.writeHead(404);
    response.end();
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  await transport.handleRequest(
    request,
    response,
    JSON.parse(Buffer.concat(chunks).toString())
  );
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`MCP server listening on http://localhost:${PORT}`);
});
