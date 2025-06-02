# GitHub Copilot instructions for the `bun-mcp` repository

This is a repository that implements a model context protocol (MCP) server for
managing to-do items.

The repository itself is a testbed for testing this MCP server and I am using
GitHub Copilot chat to test it.

The `to-do` MCP server is configured in `.vscode/mcp.json` so that the GitHub
Copilot chat can use it.

Whenever I ask GitHub Copilot to take a note of something, remember something
for me or remind me to do something, make sure the `to-do` MCP server is used to
handle such a query.

When I ask to be reminded what to do, use the to-do item listing tool to answer.
When I ask to note something specific, make it a new to-do item.

Whenver a new to-do item is added, respond confirming as such and provide the up
to date list of to-do items in the same response to give an overview of the list
at that point.

## Formatting

Always name the to-do items in sentence case.

When listing to-do items, use ✅ to annotate completed items adn ❎ to annotate
yet to be completed items.
