# libSQL HTTP Protocol Server for Cloudflare Durable Objects

A complete implementation of the libSQL HTTP protocol for accessing SQLite databases in Cloudflare Durable Objects via HTTP.

## Overview

This implementation provides **v1, v2, and v3** libSQL HTTP APIs:
- **V1 API**: Simple batch query execution
- **V2 API**: Stateful streams with "Hrana over HTTP" protocol
- **V3 API**: Enhanced Hrana with additional metadata and `get_autocommit` support

## Features

✅ **V1 API Support**
- Batch query execution in transactions
- Positional and named parameter binding
- Standard SQLite value types (Text, Integer, Real, Blob, Null)

✅ **V2 API Support**
- Stateful stream management with batons
- Multiple request types: execute, batch, sequence, describe
- SQL statement caching (store_sql/close_sql)
- Conditional batch execution
- Stream timeout and cleanup

✅ **V3 API Support (Hrana 3)**
- All v2 features plus:
- Enhanced metadata: `rows_read`, `rows_written`, `query_duration_ms`
- `get_autocommit` request type
- Column type information (`decltype`)
- Full compatibility with latest `@libsql/client`

✅ **Production Ready**
- Full error handling
- Performance metrics
- Health and version endpoints
- Cryptographically secure batons

## Quick Start

The libSQL HTTP server is automatically integrated into the `AuthDO` Durable Object. All SQL requests are served under the `/api/sql` path prefix.

### Base URLs

If your Durable Object is at `https://your-worker.your-account.workers.dev`, the SQL endpoints are:

```
V1 API: https://your-worker.your-account.workers.dev/api/sql/
V2 API: https://your-worker.your-account.workers.dev/api/sql/v2/pipeline
V3 API: https://your-worker.your-account.workers.dev/api/sql/v3/pipeline
Health:  https://your-worker.your-account.workers.dev/api/sql/health
Version: https://your-worker.your-account.workers.dev/api/sql/version
```

The `@libsql/client` library will automatically detect v3 support and use it!

## API Reference

### V1 API - Simple Batch Queries

#### Execute Queries

```http
POST /api/sql/
Content-Type: application/json
```

**Request Body:**

```typescript
{
  "statements": [
    "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT)",
    {
      "q": "INSERT INTO users (id, name) VALUES (?, ?)",
      "params": ["1", "Alice"]
    },
    {
      "q": "SELECT * FROM users WHERE name = :name",
      "params": { "name": "Alice" }
    }
  ]
}
```

**Response:**

```typescript
[
  {
    "results": {
      "columns": [],
      "rows": [],
      "rows_read": 0,
      "rows_written": 0,
      "query_duration_ms": 1.234
    }
  },
  {
    "results": {
      "columns": [],
      "rows": [],
      "rows_read": 0,
      "rows_written": 1,
      "query_duration_ms": 0.567
    }
  },
  {
    "results": {
      "columns": ["id", "name"],
      "rows": [["1", "Alice"]],
      "rows_read": 1,
      "rows_written": 0,
      "query_duration_ms": 0.234
    }
  }
]
```

#### Parameter Binding

**Positional Parameters:**

```json
{
  "q": "SELECT * FROM users WHERE id = ? AND name = ?",
  "params": ["1", "Alice"]
}
```

**Named Parameters:**

```json
{
  "q": "SELECT * FROM users WHERE id = :id AND name = :name",
  "params": {
    "id": "1",
    "name": "Alice"
  }
}
```

Named parameters support prefixes: `:name`, `@name`, `$name`

### V2 API - Hrana over HTTP

#### Check V2 Support

```http
GET /api/sql/v2
```

Returns `200 OK` if v2 is supported.

#### Execute Pipeline

```http
POST /api/sql/v2/pipeline
Content-Type: application/json
```

**Request:**

```typescript
{
  "baton": null,  // null to create new stream, or previous baton
  "requests": [
    {
      "type": "execute",
      "stmt": {
        "sql": "SELECT * FROM users WHERE id = ?",
        "args": ["1"]
      }
    }
  ]
}
```

**Response:**

```typescript
{
  "baton": "abc123...",  // Use this in next request
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

#### Request Types

**1. Execute Statement**

```json
{
  "type": "execute",
  "stmt": {
    "sql": "SELECT * FROM users",
    "args": [],
    "named_args": {}
  }
}
```

**2. Batch Execution**

```json
{
  "type": "batch",
  "batch": {
    "steps": [
      {
        "stmt": {"sql": "INSERT INTO users VALUES (?, ?)", "args": ["1", "Alice"]}
      },
      {
        "condition": {"type": "ok", "step": 0},
        "stmt": {"sql": "SELECT * FROM users WHERE id = ?", "args": ["1"]}
      }
    ]
  }
}
```

**3. Sequence (Multiple Statements)**

```json
{
  "type": "sequence",
  "sql": "CREATE TABLE t1 (id INT); CREATE TABLE t2 (id INT);"
}
```

**4. Store SQL for Reuse**

```json
{
  "type": "store_sql",
  "sql_id": 1,
  "sql": "SELECT * FROM users WHERE id = ?"
}
```

Then use it:

```json
{
  "type": "execute",
  "stmt": {
    "sql_id": 1,
    "args": ["1"]
  }
}
```

**5. Close SQL**

```json
{
  "type": "close_sql",
  "sql_id": 1
}
```

**6. Describe Statement**

```json
{
  "type": "describe",
  "sql": "SELECT * FROM users"
}
```

**7. Close Stream**

```json
{
  "type": "close"
}
```

## Usage Examples

### JavaScript/TypeScript Client

```typescript
// V1 API Example
async function queryV1(doUrl: string) {
  const response = await fetch(`${doUrl}/api/sql/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      statements: [
        "CREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, title TEXT)",
        {
          q: "INSERT INTO todos (id, title) VALUES (?, ?)",
          params: ["1", "Buy milk"]
        },
        "SELECT * FROM todos"
      ]
    })
  });

  const results = await response.json();
  console.log(results);
}

// V2 API Example with Stateful Stream
async function queryV2(doUrl: string) {
  let baton = null;

  // First request - creates stream
  const response1 = await fetch(`${doUrl}/api/sql/v2/pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baton,
      requests: [
        {
          type: "execute",
          stmt: {
            sql: "CREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, title TEXT)"
          }
        }
      ]
    })
  });

  const result1 = await response1.json();
  baton = result1.baton;

  // Second request - uses same stream
  const response2 = await fetch(`${doUrl}/api/sql/v2/pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baton,
      requests: [
        {
          type: "execute",
          stmt: {
            sql: "INSERT INTO todos (id, title) VALUES (?, ?)",
            args: ["1", "Buy milk"]
          }
        },
        {
          type: "execute",
          stmt: { sql: "SELECT * FROM todos" }
        }
      ]
    })
  });

  const result2 = await response2.json();
  console.log(result2.results);
}
```

### Python Client

```python
import requests

def query_v1(do_url: str):
    response = requests.post(f"{do_url}/api/sql/", json={
        "statements": [
            "CREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, title TEXT)",
            {
                "q": "INSERT INTO todos (id, title) VALUES (?, ?)",
                "params": ["1", "Buy milk"]
            },
            "SELECT * FROM todos"
        ]
    })

    results = response.json()
    print(results)

def query_v2(do_url: str):
    baton = None

    # First request
    response1 = requests.post(f"{do_url}/api/sql/v2/pipeline", json={
        "baton": baton,
        "requests": [{
            "type": "execute",
            "stmt": {
                "sql": "CREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, title TEXT)"
            }
        }]
    })

    result1 = response1.json()
    baton = result1["baton"]

    # Second request
    response2 = requests.post(f"{do_url}/api/sql/v2/pipeline", json={
        "baton": baton,
        "requests": [
            {
                "type": "execute",
                "stmt": {
                    "sql": "INSERT INTO todos (id, title) VALUES (?, ?)",
                    "args": ["1", "Buy milk"]
                }
            },
            {
                "type": "execute",
                "stmt": {"sql": "SELECT * FROM todos"}
            }
        ]
    })

    result2 = response2.json()
    print(result2["results"])
```

### Using with libSQL Client Libraries

The official `@libsql/client` library works perfectly with our implementation!

```typescript
import { createClient } from "@libsql/client";

const client = createClient({
  url: "http://localhost:8787/api/sql",  // Works with or without trailing slash!
  authToken: "your-auth-token",           // Optional if you add auth
});

await client.execute("SELECT * FROM users");
```

✅ **Both formats work**:
- `http://localhost:8787/api/sql/` → uses `/api/sql/v3/pipeline`
- `http://localhost:8787/api/sql` → uses `/api/v3/pipeline` (automatically routed)

If you prefer not to use the official client, you can create a simple wrapper:

```typescript
// Simple libSQL HTTP client wrapper
class SimplelibSQLClient {
  constructor(private url: string) {}

  async execute(sql: string, args?: any[]) {
    const response = await fetch(`${this.url}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statements: args
          ? [{ q: sql, params: args }]
          : [sql]
      })
    });

    const results = await response.json();
    const result = results[0].results;

    return {
      columns: result.columns,
      rows: result.rows.map((row: any) => {
        const obj: any = {};
        result.columns.forEach((col: string, i: number) => {
          obj[col] = row[i];
        });
        return obj;
      })
    };
  }

  async batch(statements: string[]) {
    const response = await fetch(`${this.url}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statements })
    });
    return await response.json();
  }
}

// Usage
const client = new SimplelibSQLClient("http://localhost:8787/api/sql");
const result = await client.execute("SELECT * FROM users WHERE id = ?", ["1"]);
console.log(result.rows);
```

## Data Types

The libSQL protocol supports these SQLite value types:

| SQLite Type | JSON Representation | Example |
|-------------|-------------------|---------|
| TEXT | String | `"hello"` |
| INTEGER | Number | `42` |
| REAL | Number | `3.14` |
| BLOB | Object with base64 | `{"base64": "SGVsbG8="}` |
| NULL | null | `null` |

## Error Handling

### V1 API Errors

```json
{
  "error": "Query execution failed: no such table: users"
}
```

### V2 API Errors

```json
{
  "baton": "abc123...",
  "base_url": null,
  "results": [
    {
      "type": "error",
      "error": {
        "message": "SQL syntax error"
      }
    }
  ]
}
```

## Stream Management (V2)

- Streams are automatically created when `baton` is `null`
- Each response includes a new `baton` for the next request
- Streams expire after **5 minutes** of inactivity
- Always use the latest `baton` from the response
- Call `close` request to explicitly close a stream

## Performance Considerations

### V1 API
- All statements in a request execute as a **transaction**
- Suitable for one-off queries or simple scripts
- No state maintained between requests

### V2 API
- Maintains stream state between requests
- Better for interactive applications
- Can cache SQL statements with `store_sql`
- Supports conditional execution in batches

## Security Notes

1. **Authentication**: The current implementation does not enforce authentication on SQL endpoints. Consider adding middleware to check tokens.

2. **SQL Injection**: Always use parameterized queries:
   ```typescript
   // ✅ Safe
   { q: "SELECT * FROM users WHERE id = ?", params: [userId] }

   // ❌ Unsafe
   { q: `SELECT * FROM users WHERE id = '${userId}'` }
   ```

3. **Baton Security**: Batons are cryptographically secure and unpredictable.

## Adding Authentication

To add authentication to SQL endpoints, modify `auth-do.ts`:

```typescript
protected isLibSQLRequest(path: string): boolean {
  return path.startsWith("/sql/");
}

async fetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (this.isLibSQLRequest(path)) {
    // Add authentication check
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.slice(7);
    const user = await this.getAuthenticatedUser(token);
    if ("error" in user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Continue with SQL request...
  }

  // Rest of the fetch handler...
}
```

## Health Checks

```bash
# Check server health
curl https://your-worker.your-account.workers.dev/api/sql/health

# Get version
curl https://your-worker.your-account.workers.dev/api/sql/version
```

## Troubleshooting

### Common Issues

**1. "Invalid or expired baton" (V2)**
- You're using an old baton. Always use the latest baton from the previous response.
- The stream may have expired (5 minute timeout).

**2. "SQL not provided and sql_id not found"**
- You're trying to use a `sql_id` that wasn't stored with `store_sql`.

**3. Empty rows but query should return data**
- Check your SQL syntax
- Verify the table exists and has data
- Check parameter binding

## Limitations

1. **Protobuf Encoding**: V3 Protobuf encoding (`v3-protobuf`) is not yet implemented. JSON encoding works for all versions.
2. **Transactions**: Manual `BEGIN/COMMIT` are intercepted and handled gracefully (DOs use automatic transactions).
3. **Blob Support**: Blobs are base64 encoded - decode them in your application.
4. **Stored SQL**: Only available within a stream, not persisted across streams.
5. **Describe**: Returns basic information; full SQL parsing not implemented.

## References

- [libSQL HTTP API Specification (v1)](./libsql-http-server-protocol/http-api.md)
- [libSQL HTTP API Specification (v2)](./libsql-http-server-protocol/http-v2-spec.md)
- [libSQL Documentation](https://github.com/tursodatabase/libsql)
- [Cloudflare Durable Objects SQL API](https://developers.cloudflare.com/durable-objects/api/sql-api/)

## License

MIT

