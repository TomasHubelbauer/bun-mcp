#!/bin/bash

# Start the server in the background
echo "Starting MCP server..."
bun . . &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Test tools/list
echo "Testing tools/list..."
RESPONSE=$(curl -s -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}')

echo "Raw response:"
echo "$RESPONSE"
echo ""

# Extract JSON data from SSE format
JSON_DATA=$(echo "$RESPONSE" | grep "^data: " | sed 's/^data: //')

# Parse and display tool names
echo "Available tools:"
echo "$JSON_DATA" | jq -r '.result.tools[].name' 2>/dev/null || echo "Failed to parse tools"
echo ""

# Test add-todo
echo "Testing add-todo..."
RESPONSE=$(curl -s -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"add-todo","arguments":{"name":"Test todo item"}},"id":2}')
echo "$RESPONSE" | grep "^data: " | sed 's/^data: //' | jq '.'

echo ""

# Test list-todos
echo "Testing list-todos..."
RESPONSE=$(curl -s -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list-todos","arguments":{}},"id":3}')
echo "$RESPONSE" | grep "^data: " | sed 's/^data: //' | jq '.'

# Kill the server
echo ""
echo "Killing server process..."
kill $SERVER_PID

echo "Test complete"