# libSQL HTTP Protocol - Quick Reference Card

## Endpoints

```
Base URL: https://your-worker.com/api/sql

V1 API:   POST /
V2 API:   POST /v2/pipeline
Health:   GET  /health
Version:  GET  /version
V2 Check: GET  /v2
```

## V1 API - Simple Queries

### Basic Query
```bash
POST /
{
  "statements": [
    "SELECT * FROM users"
  ]
}
```

### Positional Parameters
```bash
POST /
{
  "statements": [
    {
      "q": "SELECT * FROM users WHERE id = ? AND age > ?",
      "params": ["123", 25]
    }
  ]
}
```

### Named Parameters
```bash
POST /
{
  "statements": [
    {
      "q": "SELECT * FROM users WHERE name = :name AND age > :age",
      "params": {
        "name": "Alice",
        "age": 25
      }
    }
  ]
}
```

### Batch Transaction
```bash
POST /
{
  "statements": [
    "BEGIN",
    "INSERT INTO users VALUES ('1', 'Alice')",
    "INSERT INTO users VALUES ('2', 'Bob')",
    "COMMIT"
  ]
}
```

## V2 API - Stateful Streams

### Create Stream & Execute
```bash
POST /v2/pipeline
{
  "baton": null,
  "requests": [
    {
      "type": "execute",
      "stmt": {
        "sql": "SELECT * FROM users WHERE id = ?",
        "args": ["123"]
      }
    }
  ]
}

# Response includes baton for next request
```

### Continue Stream
```bash
POST /v2/pipeline
{
  "baton": "abc123...",  # From previous response
  "requests": [
    {
      "type": "execute",
      "stmt": {
        "sql": "INSERT INTO users VALUES (?, ?)",
        "args": ["3", "Charlie"]
      }
    }
  ]
}
```

### Batch with Conditions
```bash
POST /v2/pipeline
{
  "baton": null,
  "requests": [
    {
      "type": "batch",
      "batch": {
        "steps": [
          {
            "stmt": {
              "sql": "INSERT INTO users VALUES (?, ?)",
              "args": ["1", "Alice"]
            }
          },
          {
            "condition": { "type": "ok", "step": 0 },
            "stmt": {
              "sql": "SELECT * FROM users WHERE id = ?",
              "args": ["1"]
            }
          }
        ]
      }
    }
  ]
}
```

### Store & Reuse SQL
```bash
# Store SQL
POST /v2/pipeline
{
  "baton": null,
  "requests": [
    {
      "type": "store_sql",
      "sql_id": 1,
      "sql": "SELECT * FROM users WHERE id = ?"
    }
  ]
}

# Use stored SQL
POST /v2/pipeline
{
  "baton": "abc123...",
  "requests": [
    {
      "type": "execute",
      "stmt": {
        "sql_id": 1,
        "args": ["123"]
      }
    }
  ]
}
```

### Close Stream
```bash
POST /v2/pipeline
{
  "baton": "abc123...",
  "requests": [
    {
      "type": "close"
    }
  ]
}
```

## JavaScript/TypeScript Examples

### Using Fetch
```typescript
const response = await fetch("https://your-worker.com/api/sql/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    statements: [
      {
        q: "SELECT * FROM users WHERE email = ?",
        params: ["user@example.com"]
      }
    ]
  })
});

const results = await response.json();
console.log(results[0].results.rows);
```

### Using libSQL Client
```typescript
import { createClient } from "@libsql/client";

const client = createClient({
  url: "https://your-worker.com/api/sql"  // Works with or without trailing slash!
});

const result = await client.execute("SELECT * FROM users");
console.log(result.rows);
```

### V2 Stateful Stream
```typescript
let baton = null;

// First request
const res1 = await fetch("https://your-worker.com/api/sql/v2/pipeline", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    baton,
    requests: [
      { type: "execute", stmt: { sql: "SELECT 1" } }
    ]
  })
});

const data1 = await res1.json();
baton = data1.baton;

// Second request (same stream)
const res2 = await fetch("https://your-worker.com/api/sql/v2/pipeline", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    baton,
    requests: [
      { type: "execute", stmt: { sql: "SELECT 2" } }
    ]
  })
});
```

## Python Examples

### Using Requests
```python
import requests

response = requests.post(
    "https://your-worker.com/api/sql/",
    json={
        "statements": [
            {
                "q": "SELECT * FROM users WHERE email = ?",
                "params": ["user@example.com"]
            }
        ]
    }
)

results = response.json()
print(results[0]["results"]["rows"])
```

### V2 Stateful Stream
```python
import requests

# Create stream
res1 = requests.post(
    "https://your-worker.com/api/sql/v2/pipeline",
    json={
        "baton": None,
        "requests": [
            {"type": "execute", "stmt": {"sql": "SELECT 1"}}
        ]
    }
)

data1 = res1.json()
baton = data1["baton"]

# Continue stream
res2 = requests.post(
    "https://your-worker.com/api/sql/v2/pipeline",
    json={
        "baton": baton,
        "requests": [
            {"type": "execute", "stmt": {"sql": "SELECT 2"}}
        ]
    }
)
```

## Curl Examples

### Simple Query
```bash
curl -X POST https://your-worker.com/api/sql/ \
  -H "Content-Type: application/json" \
  -d '{"statements":["SELECT * FROM users LIMIT 5"]}'
```

### Parameterized Query
```bash
curl -X POST https://your-worker.com/api/sql/ \
  -H "Content-Type: application/json" \
  -d '{
    "statements": [
      {
        "q": "SELECT * FROM users WHERE email = ?",
        "params": ["user@example.com"]
      }
    ]
  }'
```

### V2 Execute
```bash
curl -X POST https://your-worker.com/api/sql/v2/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "baton": null,
    "requests": [
      {
        "type": "execute",
        "stmt": {"sql": "SELECT * FROM users"}
      }
    ]
  }'
```

### Health Check
```bash
curl https://your-worker.com/api/sql/health
```

## Response Formats

### V1 Success Response
```json
[
  {
    "results": {
      "columns": ["id", "name", "email"],
      "rows": [
        ["1", "Alice", "alice@example.com"],
        ["2", "Bob", "bob@example.com"]
      ],
      "rows_read": 2,
      "rows_written": 0,
      "query_duration_ms": 1.234
    }
  }
]
```

### V1 Error Response
```json
{
  "error": "SQL error: no such table: users"
}
```

### V2 Success Response
```json
{
  "baton": "abc123...",
  "base_url": null,
  "results": [
    {
      "type": "ok",
      "response": {
        "type": "execute",
        "result": {
          "cols": [{"name": "id"}, {"name": "name"}],
          "rows": [["1", "Alice"]],
          "affected_row_count": 0,
          "last_insert_rowid": null
        }
      }
    }
  ]
}
```

### V2 Error Response
```json
{
  "baton": "abc123...",
  "base_url": null,
  "results": [
    {
      "type": "error",
      "error": {
        "message": "SQL error: syntax error"
      }
    }
  ]
}
```

## Data Types

| SQLite | JSON           | Example               |
|--------|----------------|-----------------------|
| TEXT   | string         | `"hello"`            |
| INTEGER| number         | `42`                 |
| REAL   | number         | `3.14`               |
| BLOB   | object         | `{"base64":"SGVs"}` |
| NULL   | null           | `null`               |

## Request Types (V2)

| Type        | Description                  |
|-------------|------------------------------|
| `execute`   | Execute single statement     |
| `batch`     | Execute multiple with logic  |
| `sequence`  | Execute multiple SQL         |
| `describe`  | Get statement metadata       |
| `store_sql` | Cache SQL for reuse         |
| `close_sql` | Remove cached SQL           |
| `close`     | Close stream                |

## Condition Types (V2 Batch)

| Type    | Description                    |
|---------|--------------------------------|
| `ok`    | Execute if step succeeded     |
| `error` | Execute if step failed        |
| `not`   | Negate another condition      |

## Quick Tips

✅ **Always use parameterized queries** to prevent SQL injection
✅ **Use V1 for simple scripts**, V2 for interactive apps
✅ **Store frequently used SQL** with `store_sql` in V2
✅ **Streams timeout after 5 minutes** of inactivity
✅ **Always use the latest baton** from responses
✅ **Batch queries in one request** to reduce HTTP overhead

## Testing

```bash
# Run comprehensive test suite
bun run worker/bettar-auth-do-sqlite/test-libsql-http.ts http://localhost:8787
```

## Documentation

📖 Full docs: `LIBSQL-HTTP-SERVER.md`
📋 Implementation: `LIBSQL-IMPLEMENTATION-SUMMARY.md`
🔧 Test suite: `test-libsql-http.ts`

## Common Errors

### "Invalid or expired baton"
- Use the latest baton from the previous response
- Stream may have expired (5 min timeout)

### "SQL not provided and sql_id not found"
- The sql_id wasn't stored with `store_sql`
- Store it first before using

### "no such table"
- Table doesn't exist
- Create it first with CREATE TABLE

---

**Quick Start:**
```bash
curl -X POST https://your-worker.com/api/sql/ \
  -H "Content-Type: application/json" \
  -d '{"statements":["SELECT * FROM user LIMIT 1"]}'
```

