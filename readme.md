# Bun MCP

The goal of this repository is to prototype an [MCP (model context protocol)](https://modelcontextprotocol.io)
server using the [Bun](https://bun.sh) runtime and use its tools through the VS
Code Copilot chat agent mode.

I started off by reading though the Model Context Protocol documentation.
In the nomenclature of the MCP documentation, these will be the elements we use:

- Host with client: VS Code with Copilot chat in agent mode
- Server: the script implemented in this repository

For this setup, the documentation has a specific learning path:

[For Server Developers](https://modelcontextprotocol.io/quickstart/server)

MCP servers work by exposing tools which are aking to REST endpoints and the LLM
used by the MCP client can invoked these tools if it determines the user prompt
could benefit from data this tools are able to provide.

The documentation page provides a sample weather service MCP server, which is a
good example as LLMs are not capable of providing weather information given the
fact that weather forecast is a live datum and thus not possible to infer by the
LLM.

I will build an MCP server capable of managing a to-do list in a MarkDown file.
The goal of the MCP server is to give the user the tools required to created and
maintain this document by allowing them to add, toggle and remove to-do items.

A thing worth mentioning is that MCP servers can provide different types of data
to the MCP clients:

- Resources: contents of files and data blobs
- Tools: methods for the LLM to invoke and use the result of
- Prompts: pre-defined prompts to help improve user prompts for best results

As in the documentation page, my MCP server will focus on providing tools only.

Unlike the documentation page, I will be using Bun and not Node.
That being said I will probably still be able to benefit from the reference
implementation [here](https://github.com/modelcontextprotocol/quickstart-resources/tree/main/weather-server-typescript).

The tutorial page includes a server implementation based around an SDK package.
I will take that route first, but down the line, I would like to build a server
from scratch, implementing the raw protocol.

As I understand it, this should not be very difficult as the servers are capable
of communicating over standard I/O as well as server-sent events, both primitive
to implement without any dependencies.

- [ ] Drop the SDK package and rebuild the server with direct MCP protocol

Until them, I am starting off by adding the `@modelcontextprotocol/sdk` package
as a dependency using `bun add @modelcontextprotocol/sdk`.

Bun will create the `package.json` file and as with all my personal projects, I
am changing the version to `latest` so that the project doesn't get stuck on an
old version.

`package.json`:

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest"
  }
}
```

I am also adding a `.gitignore` file and ignoring `node_modules` and `bun.lock`.
I do not do dependency vendoring and I do not require a lock file as all the
dependencies should always install at their latest version no matter what.

The meat and potatoes of the server will live in a new file named `index.ts`.
I assume in the client configuration I will be able to specify the server via a
command and an argument, which if it is the case, will make it really easy by
just specifying `bun `. as the command and argument pair.

My script will be ESM and will have no build steps as per the usual.
It will use TypeScript via Bun's native TypeScript support and won't override
Bun's default TypeScript configuration.

This basic MCP SDK `import` and server manifest specification look like this:

`index.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({
  name: "to-do",
  version: "0.0.0",
  capabilities: {
    tools: {},
  },
});
```

The next step is to register tools for the MCP server to expose.
I will start with one - `list-todos` and it will return hard-coded data for now.

```typescript
server.tool("list-todos", "Lists all to-do items in the TODO.md file", () => {
  return {
    content: [
      {
        type: "text",
        text: "- [ ] Do the dishes\n- [ ] Go grocery shopping\n- [ ] Plan the weekend trip",
      },
    ],
  };
});
```

With an tool defined, it is time to configure the server transport so that the
clients know how to talk to the server.
This requires a new `import` atop the file, I am choosing to use the standard
I/O for this.

```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// …

const transport = new StdioServerTransport();
await server.connect(transport);
```

At this point, it is time to test the MCP server.
The documentation page demonstrates how to do this with Claude so I will defer
elsewhere to learn how to configure this in VS Code.

The VS Code documentation on MCP lists several options:
https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server

I much prefer the workspace configuration option, so I have created an empty
`.vscode/mcp.json` file in the workspace of this repository and opened it in a
new VS Code tab.

VS Code recognizes this special path and displays a button titled Add Server at
the bottom right corner of the file editor area.

I clicked the button and selected the Command (stdio) option.

At this point, a bit of fiddling and experimentation had to take place.
The command I tried first was just `bun`, but I didn't realize this flow would
not ask me for an argument for the command.
The only other thing it asked about was the server name, where I put `to-do`.

The server failed to start and in the Output pane in the MCP: to-do channel I
could see why - the VS Code host executed the command and started interpreting
its standard I/O streams for transport.

But since the command was just `bun`, it printed its default output when no
script is provided or discovered.
These lines failed to parse as MCP messages, so the connection failed to be
established.

This is the incorrect configuration:

```json
{
  "servers": {
    "to-do": {
      "type": "stdio",
      "command": "bun",
      "args": []
    }
  }
}
```

At this point I started tweaking the JSON code itself instead of relying on the
VS Code UI flow.

I figured a simple fix could be to change the command to `bun .` so that Bun was
invoked and attempted to start `index.ts`.

I hit the Restart code lens that VS Code put atop the server entry.
This resulted in an error, again.

It seems that MCP servers that are defined as commands are not run in the
workspace directory.
To verify this, I changed the command to `pwd` and re-ran it.
This printed `/Users/tom` confirming my suspicion.

From here there are multiple options.
I do not want to hard-code the full path of the script as the argument to Bun,
so I think I could rely on VS Code configuration substitutions:
https://code.visualstudio.com/docs/reference/variables-reference

I changed the command to `echo '${workspaceFolder}'` to see if it would print
the value of the variable in the Output window and hit Restart again.

This printed the expected directory!
Of course the server still did not start, but at this point I knew the final
command would have to be `bun ${workspaceFolder}`.
I was surprised to see this not work either, but I soon realized I should pass
the `workspaceFolder` variable as an argument in the `args` field instead.

I changed the command to `echo` once again to make sure everything would still
work as expected:

```json
{
  "servers": {
    "to-do": {
      "type": "stdio",
      "command": "echo",
      "args": ["${workspaceFolder}"]
    }
  }
}
```

This printed `[warning] Failed to parse message: "/Users/tom/Desktop/bun-mcp\n"`
letting me know the variable substitution and command passing worked.

I could change the `command` to `bun` now and get the server to start up.
The code lens atop the server entry changed to say "Running…" and I saw a flurry
of activity in the Output tab as well:

```
[info] Connection state: Starting
[info] Starting server from LocalProcess extension host
[info] Connection state: Starting
[info] Connection state: Running
[info] Discovered 1 tools
```

This means my MCP server and its sole tool are discovered and I can try a prompt
that should trigger it in the VS Code GitHub Copilot chat pane in agent mode.

I opened GitHub Copilot chat using the Copilot icon to the right of the command
bar in the top center of the VS Code window.

It starts off the in Ask mode so I toggled that switch to Agent.
This brings some new icons to the chat composer: Start Voice Chat, Select Tools
and Discover Tools / New Tools Available (hidden if not applicable).

I clicked on the Select Tools button and checked the list that opened to see the
`to-do` server was listed and checked along with its `list-todos` tool!

This means my prompt should be able to use this tool now.
I asked Copilot:

> What todos do I have on my list?

It was either not smart enough or too smart, because it used the checkbox list
in this README file (which was automatically included as a reference in the chat
as evidenced by the item atop the prompt input area) and answered by listing the
to-do checkboxes in it.

I clicked the eye icon next to `readme.md` to remove the current file reference
from the prompt context and re-ran the same prompt.

This time, Copilot Chat asked me whether I want to allow the `to-do` MCP server
to run the `list-todos` tool with a Continue and Cancel buttons presented.
I selected the chevron next to the Continue button and selected Always Allow in
This Workspace so that my MCP server would be allowed to run uninterrupted in
this repository directory from now on.

The Copilot Chat changed to indicate it ran the `list-todos` tool of my `to-do`
server and responded with:

> Your current to-do list contains the following items:
> `<input disabled="" type="checkbox">` Do the dishes
> `<input disabled="" type="checkbox">` Go grocery shopping
> `<input disabled="" type="checkbox">` Plan the weekend trip
> Let me know if you want to add, remove, or update any of these tasks!

Amusingly, the MarkDown checkboxes do not render in the Copilot chat UI so I
think I will have to go with emoji when I am changing the tool to not return
hard-coded data.

Also, Copilot is confident it can help me edit this list despite my MCP server
not exposing tools for doing that yet.
I'll chalk that one up to hallucinations/insufficiently intelligent prompt for
the MCP server interaction.

For the next step, I will add a tool for creating a new to-do item and change
the existing tool for listing to-do items to use an in-memory storage so that I
can add and list this new to-do item.

When it comes to registering tools with arguments, the MCP SDK seems to be tied
to Zod for schema validation of the structure of arguments to the MCP tools.
I do not prefer this and in my future implementation where I implement the MCP
protocol by hand, I will drop the Zod dependency, but for now I will oblige and
use it:

`bun add zod`

`package.json`:

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "zod": "lates"
  }
}
```

Here's how I changed `index.ts` to accomplish this:

```typescript
import { z } from "zod";

// …

const todos: { name: string; isChecked: boolean }[] = [];

server.tool("list-todos", "Lists all to-do items in the TODO.md file", () => {
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
});

server.tool(
  "add-todo",
  "Adds a new to-do item to the TODO.md file",
  {
    name: z.string().describe("The name of the to-do item"),
  },
  ({ name }) => {
    const newTodo = { name, isChecked: false };
    todos.push(newTodo);

    return {
      content: [
        {
          type: "text",
          text: `Added new to-do item: ${newTodo.name}`,
        },
      ],
    };
  }
);

// …
```

After making these changes, I went to the `mcp.json` tab again and pressed the
Restart code lens action to make the changes take an effect.

The other code lens item changed to say "2 tools" indicating the changes did
indeed take place further corroborated by the log of the Output pane in the
MCP: to-do channel which now added these lines:

```
[info] Stopping server to-do
[info] Connection state: Stopped
[info] Starting server to-do
[info] Connection state: Starting
[info] Starting server from LocalProcess extension host
[info] Connection state: Starting
[info] Connection state: Running
[info] Discovered 2 tools
```

I kept the current file reference outside of the Copilot chat context and asked
it to add a new to-do item for me:

> Add a todo to buy groceries for dinner

I was again prompted to either Continue or Cancel the `to-do` MCP server call,
this time for the `add-todo` tool, which I found surprising and I guess this
check is presented on a per-tool basis as opposed to per-server basis as I
initially expected.

I again chose the Always in this Workspace option in the Continue dropdown.

Copilot responded with:

> A new to-do item "Buy groceries for dinner" has been added to your list.
> If you need to view, update, or remove any to-dos, just let me know!

I expanded the "Ran `add-todo`" box atop the Copilot response to drill down.
It printed the input it crafted based on the prompt as well as the output from
the MCP server.

Input:

```json
{
  "name": "Buy groceries for dinner"
}
```

Output:

> Added new to-do item: Buy groceries for dinner

Next I asked what todos were on my list:

> What todos do I have on my list?

This time, I wasn't prompted to allow the tool run, it ran without interruption,
so the prompt really seems to be per-tool.

Copilot responded with:

> Your current to-do list contains:
> `<input disabled="" type="checkbox">` Buy groceries for dinner
> Let me know if you want to add, remove, or update any to-dos!

Inspecting the tool call box for details:

Input:

```
{}
```

Output:

> ❎ Buy groceries for dinner

So it seems the Copilot LLM took this tool response and reformated it to a
MarkDown checklist on its own which means we've run afoul of the broken MarkDown
rendering in the VS Code Copilot Chat again.

I am not sure if this can be prevented with tools along, but the MCP server
could potentially expose a prompt that would reword the simple query for the
to-do list view into a richer query instructing Copilot to format the list in a
particular way, possibly using the emojis I used in the code instead of a
MarkDown checklist.

- [ ] Expose a prompt to enrich user prompts to avoid MarkDown list rendering

Two things are left to make the to-do list management flow complete: toggling
and removing to-do items.

I added a tool for toggling to-do items based on a keyword like so:

```typescript
server.tool(
  "toggle-todo",
  "Toggles the completion status of a to-do item",
  {
    keyword: z
      .string()
      .describe("A keyword in the name of the to-do item to toggle"),
  },
  ({ keyword }) => {
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
```

I restarted the MCP server in VS Code and asked Copilot:

> Cross the dinner to-do item off

I confirmed Always in this Workspace for the `toggle-todo` tool call and go this
reply:

> It appears that the to-do item containing "dinner" was not found.
> Could you please confirm the exact wording of the to-do, or let me know if it
> was recently changed or removed?

I realized the issue was the MCP server restart losing the in-memory storage
state, so another thing was left to do, actually: persistence.

I planned on replaced the `todos` constant with I/O helpers to read and write
the to-do items to the storage.

To implement these helpers, I used Bun's I/O methods which required me to add
Bun types to the dependencies so the I/O methods were accessible in TypeScript:

`bun add -D @types/bun`

`package.json`:

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

I imported Bun using `import Bun from "bun";` and realized that in order to be
able to write helpers for I/O, I would need to make sure the script was aware of
the directory path to use.

I assumed that the working directory of the script was `/Users/tom` because we
are invoking `bun` with a full path to the VS Code workspace precisely because
it starts off in that directory.

I decided to still verify this by changing the default `todos` to list the full
path of the directory the script was running in:

```typescript
const todos: { name: string; isChecked: boolean }[] = [
  {
    name: `Know that the working directory is ${import.meta.dirname}`,
    isChecked: true,
  },
];
```

I restarted the server and asked Copilot what my todos were and it said:

> Your current to-do list contains:
> `<input checked="" disabled="" type="checkbox">` Know that the working directory is /Users/tom/Desktop/bun-mcp
> Let me know if you want to add, remove, or update any to-dos!

So, surprisingly (to me), if a script is invoked via a directory path I guess it
sets the working directory to that path.
This simplifies affairs a bit.

I replaced the `todos` constant with this code:

```typescript
const FILE_PATH = "TODO.md";

async function readTodos() {
  const text = await Bun.file(FILE_PATH).text();
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
  await Bun.write(FILE_PATH, content);
}
```

I also updated the three existing tools to make their callback methods `async`
and add `const todos = await readTodos()` to make the usages of `todos` work
again and add `await writeTodos(todos)` whenever a to-do item was mutated to
persist the changes to the file.

I restarted the MCP server and started off with this prompt:

> Add taking out the bin to my todo list

The output of the tool call said this:

> ENOENT: no such file or directory, open 'TODO.md'

I didn't remember that `Bun.file().text` would throw on a non-existent file and
AFAIK there is no mechanism to provide fall-back content so I changed the I/O
helper methods like so:

```typescript
const FILE = Bun.file("TODO.md");

async function readTodos() {
  const text = (await FILE.exists()) ? await FILE.text() : "";
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
  await Bun.write(FILE, content);
}
```

I restarted the MCP server and tried again by pressing the up-arrow key in the
chat composer to recall the last message that was sent and resending it.

GitHub Copilot was too smart again, because it created `TODO.md` on its own and
added the MarkDown checkbox to it without calling my MCP server.

I reworded the prompt to hopefully hit my MCP server:

> Add a new to-do item to my to-do list for taking out the trash

This resulted in the exact same thing happening so I instead asked:

> What items are on my to-do list?

This invoked by MCP server correctly.

> Your to-do list is currently empty.
> If you would like to add a new item, just let me know what you'd like to include!

I followed-up with:

> Add an item for taking out the trash

This didn't work either so I used the Select Tools button again and unchecked
the Codebase option under GitHub Copilot Chat hoping it would prevent it from
being able to write files, but it didn't work, so I turned it back on.

I resorted to this prompt:

> Add a todo using my to-do list MCP server for taking out the trash

This invoked the right tool correctly, but I didn't see `TODO.md` be created so
I asked what files were on my to-do list to learn that it was empty.

I do not know how to debug MCP server scripts yet, so I resorted to more debug
information smuggling via tool results, but this time I realized I should have
used `process.cwd()` instead of `import.meta.dir` the whole time!

- [ ] Figure out how to run MCP server scripts under VS Code debugger

I scraped the idea of adding more information to the tools and instead went
straight to the Terminal app and ran `cd ~` followed by `ls`.

This let me see the `TODO.md` file in my macOS user directory.
I ran `cat TODO.md` and saw the new to-do item there.

This means the file is being written correctly (albeit missing the EOF newline),
which raises the question of why I am not seeing the new to-do item in the reply
to `list-todos`.

But, first things first, I needed to find a way to tell the MCP server what the
workspace directory was and it couldn't me `import.meta.dir`, because this case
where the workspace directory of the workspace where I am using GitHub Copilot
is the same as the workspace directory where I am developing it as a special
case that is not going to hold for other workspaces.

I changed the `args` line in `mcp.json` to this:

```json
"args": ["${workspaceFolder}", "${workspaceFolder}"]
```

This way I can use `process.argv` and get the sole argument of the script (aside
of the script file itself) and derive the working directory from that.

It is not ideal that the MCP server needs to be installed in a way where the
workspace directory is passed explicitly, it should be able to ask for this type
of information itself, but presently I do not know of a way to do that or if it
even is supported in the MCP protocol.

From a quick web search, it appears the answer may be that it isn't.
I found some mentions of `process.env.WORKSPACE_FOLDER_PATHS` which is not there
in my MCP server's `process.env` and I also found a note that `.` expands to the
workspace root directory in the `mcp.json` `args` configuration, which I tested
and it didn't seem to work either.

For now I will stick with the double-`workspaceFolder` in `args.`

- [ ] File a VS Code issue asking to pass workspace root to MCP server scripts

I added a check at the top of the MCP server script to guide users and to change
the working directory if it is correctly provided:

```typescript
if (!process.argv[2]) {
  throw new Error(
    'Register the MCP server with `args` set to `["${workspaceFolder}", "${workspaceFolder}"]`.'
  );
}

process.chdir(process.argv[2]);
```

With these changes, I should now be able to re-run the specific prompt asking to
make a new todo and see the `TODO.md` file appear created by my MCP server, not
the Copilot agent itself.

I restarted the server and tried.

> Add a todo using my to-do list MCP server for taking out the trash

I saw `TODO.md` and it had the right contents:

```markdown
- [ ] Take out the trash
```

At this point I realized for this particular repository, since the `TODO.md`
file is a part of testing data, essentially, I should ignore it.
It should only be left unignored in workspaces other than this one that happen
to use the MCP server.

`.gitignore`:

```shell
TODO.md

# NPM
node_modules

# Bun
bun.lock
```

I tried the "What's on my todo list?" prompt again and it replied saying there
were no todos.
I suspected the `const` with the `Bun.File` instance was probably caching
something and I should re-create it in each call to `readTodos`.
This suspicion was made stronger by the fact when I restarted the MCP server
with no changes, the to-do item was now listed.

I changed the I/O helpers like so:

```typescript
const FILE_NAME = "TODO.md";

async function readTodos() {
  const text = (await Bun.file(FILE_NAME).exists())
    ? await Bun.file(FILE_NAME).text()
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
  await Bun.write(FILE_NAME, content);
}
```

This brought the correct behavior and stuff now worked!
I was also able to ask the chat to mark a to-do as done and it would correctly
call the `toggle-todo` tool.

- [ ] Add an option argument to `toggle-todo` to force direct on/off state

I added another tool for deleting todos by a keyword similar to the one for
toggling them:

```typescript
server.tool(
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
```

This brings the basic behavior to completion.
There was many ways in which this toy MCP server could be improved which I will
save for the future.

- [ ] Consider including updated to-do list in responses to avoid user asking to
      see the updated list all the time
