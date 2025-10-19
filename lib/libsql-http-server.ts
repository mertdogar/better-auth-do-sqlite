/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * libSQL HTTP Protocol Server Implementation
 *
 * Implements both v1 (simple batch) and v2 (Hrana over HTTP) protocols
 * for SQLite access via HTTP endpoints.
 *
 * Specifications:
 * - v1: Simple POST / endpoint with batch queries
 * - v2: POST /v2/pipeline with stateful streams and batons
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * SQLite value types as defined in libSQL protocol
 */
export type SqlValue =
  | string // Text
  | number // Integer or Real
  | null // Null
  | { base64: string } // Blob (base64 encoded)

/**
 * Query can be a plain string or a parameterized query
 */
export type Query = string | ParamQuery

export interface ParamQuery {
  q: string
  params?: Record<string, SqlValue> | SqlValue[]
}

/**
 * V1 API Request/Response Types
 */
export interface QueryBody {
  statements: Query[]
}

export interface QueryResult {
  results: {
    columns: string[]
    rows: SqlValue[][]
    rows_read: number
    rows_written: number
    query_duration_ms: number
  }
}

export type BatchResponse = QueryResult[] | { error: string }

/**
 * V2 API Request/Response Types (Hrana over HTTP)
 */
export interface PipelineRequest {
  baton?: string | null // Optional - defaults to null if not provided
  requests: StreamRequest[]
}

export interface PipelineResponse {
  baton: string | null
  base_url: string | null
  results: StreamResult[]
}

export type StreamRequest =
  | CloseStreamReq
  | ExecuteStreamReq
  | BatchStreamReq
  | SequenceStreamReq
  | DescribeStreamReq
  | StoreSqlStreamReq
  | CloseSqlStreamReq
  | GetAutocommitStreamReq

export type StreamResponse =
  | CloseStreamResp
  | ExecuteStreamResp
  | BatchStreamResp
  | SequenceStreamResp
  | DescribeStreamResp
  | StoreSqlStreamResp
  | CloseSqlStreamResp
  | GetAutocommitStreamResp

export type StreamResult =
  | { type: 'ok'; response: StreamResponse }
  | { type: 'error'; error: { message: string } }

export interface CloseStreamReq {
  type: 'close'
}

export interface CloseStreamResp {
  type: 'close'
}

export interface ExecuteStreamReq {
  type: 'execute'
  stmt: Stmt
}

export interface ExecuteStreamResp {
  type: 'execute'
  result: StmtResult
}

export interface BatchStreamReq {
  type: 'batch'
  batch: Batch
}

export interface BatchStreamResp {
  type: 'batch'
  result: BatchResult
}

export interface SequenceStreamReq {
  type: 'sequence'
  sql?: string | null
  sql_id?: number | null
}

export interface SequenceStreamResp {
  type: 'sequence'
}

export interface DescribeStreamReq {
  type: 'describe'
  sql?: string | null
  sql_id?: number | null
}

export interface DescribeStreamResp {
  type: 'describe'
  result: DescribeResult
}

export interface StoreSqlStreamReq {
  type: 'store_sql'
  sql_id: number
  sql: string
}

export interface StoreSqlStreamResp {
  type: 'store_sql'
}

export interface CloseSqlStreamReq {
  type: 'close_sql'
  sql_id: number
}

export interface CloseSqlStreamResp {
  type: 'close_sql'
}

export interface GetAutocommitStreamReq {
  type: 'get_autocommit'
}

export interface GetAutocommitStreamResp {
  type: 'get_autocommit'
  is_autocommit: boolean
}

export interface Stmt {
  sql?: string
  sql_id?: number
  args?: (SqlValue | HranaValue)[]
  named_args?: Record<string, SqlValue> | HranaValue[] | NamedArg[]
  want_rows?: boolean
}

/**
 * Hrana protocol value format (what @libsql/client sends)
 */
export interface HranaValue {
  type: 'null' | 'integer' | 'float' | 'text' | 'blob'
  value?: any
}

export interface StmtResult {
  cols: { name: string; decltype?: string | null }[]
  rows: (HranaValue | null)[][] // Hrana format for v2+
  affected_row_count: number
  last_insert_rowid: string | null
  rows_read?: number // v3
  rows_written?: number // v3
  query_duration_ms?: number // v3
}

export interface NamedArg {
  name: string
  value: HranaValue
}

export interface Batch {
  steps: BatchStep[]
}

export interface BatchStep {
  condition?: BatchCond | null
  stmt: Stmt
}

export interface BatchCond {
  type: 'ok' | 'error' | 'not'
  step?: number
  cond?: BatchCond
}

export interface BatchResult {
  step_results: (StmtResult | null)[]
  step_errors: ({ message: string } | null)[]
}

export interface DescribeResult {
  params: { name: string | null }[]
  cols: { name: string }[]
  is_explain: boolean
  is_readonly: boolean
}

// ============================================================================
// libSQL HTTP Server Implementation
// ============================================================================

export class LibSQLHttpServer {
  private sql: any
  private streams: Map<string, StreamState> = new Map()
  private streamTimeouts: Map<string, number> = new Map()
  private readonly STREAM_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
  private protocolVersion: 2 | 3 = 2 // Track protocol version for current request

  constructor(sql: any) {
    this.sql = sql
  }

  /**
   * Parse Hrana value format to simple SQL value
   */
  private parseHranaValue(value: SqlValue | HranaValue): SqlValue {
    if (value === null || value === undefined) return null
    if (typeof value !== 'object') return value

    // Check if it's a HranaValue object
    if ('type' in value && value.type) {
      if (value.type === 'null') return null
      return value.value ?? null
    }

    // Otherwise it's already a SqlValue
    return value as SqlValue
  }

  /**
   * Parse args array (handles both raw values and Hrana format)
   */
  private parseArgs(args?: (SqlValue | HranaValue)[]): SqlValue[] {
    if (!args || !Array.isArray(args)) return []
    return args.map((arg) => this.parseHranaValue(arg))
  }

  /**
   * Parse named_args (handles v2, v3, and object formats)
   */
  private parseNamedArgs(
    namedArgs?: Record<string, SqlValue> | HranaValue[] | NamedArg[]
  ): Record<string, SqlValue> | undefined {
    if (!namedArgs) return undefined
    if (Array.isArray(namedArgs)) {
      const result: Record<string, SqlValue> = {}

      // Check if it's NamedArg[] (v3 format with name/value objects)
      if (
        namedArgs.length > 0 &&
        namedArgs[0] &&
        typeof namedArgs[0] === 'object' &&
        'name' in namedArgs[0]
      ) {
        ;(namedArgs as NamedArg[]).forEach((arg: NamedArg) => {
          result[arg.name] = this.parseHranaValue(arg.value)
        })
      } else {
        // HranaValue[] format - map by index
        ;(namedArgs as HranaValue[]).forEach((val, idx) => {
          result[String(idx)] = this.parseHranaValue(val)
        })
      }
      return result
    }
    return namedArgs
  }

  /**
   * Handle incoming HTTP requests and route to appropriate handler
   */
  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    try {
      // Version check endpoints (for @libsql/client auto-detection)
      // V3 Protobuf - not yet implemented
      if (method === 'GET' && path === '/v3-protobuf') {
        return new Response('Not Found', { status: 404 })
      }

      // V3 JSON - supported!
      if (method === 'GET' && path === '/v3') {
        return new Response('OK', { status: 200 })
      }

      // V2 - supported!
      if (method === 'GET' && path === '/v2') {
        return new Response('OK', { status: 200 })
      }

      // V3 Pipeline endpoint (JSON)
      if (method === 'POST' && path === '/v3/pipeline') {
        this.protocolVersion = 3
        return await this.handlePipeline(request)
      }

      // V2 Pipeline endpoint
      if (method === 'POST' && path === '/v2/pipeline') {
        this.protocolVersion = 2
        return await this.handlePipeline(request)
      }

      // V1 API - Batch queries (default endpoint)
      if (method === 'POST' && (path === '/' || path === '/v1')) {
        return await this.handleV1Batch(request)
      }

      // Health check
      if (method === 'GET' && path === '/health') {
        return new Response('OK', { status: 200 })
      }

      // Version
      if (method === 'GET' && path === '/version') {
        return new Response(JSON.stringify({ version: 'libsql-do-http-0.1.0' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      console.error('LibSQL HTTP Server error:', error)
      return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  /**
   * V1 API: Handle batch queries
   */
  private async handleV1Batch(request: Request): Promise<Response> {
    try {
      const body: QueryBody = await request.json()

      if (!body.statements || !Array.isArray(body.statements)) {
        return new Response(
          JSON.stringify({ error: 'Invalid request: statements array required' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      const results: QueryResult[] = []

      // Execute all statements (V1 spec says in a transaction)
      for (const query of body.statements) {
        const startTime = performance.now()
        const result = await this.executeQuery(query)
        const duration = performance.now() - startTime

        results.push({
          results: {
            columns: result.columns,
            rows: result.rows,
            rows_read: result.rowsRead,
            rows_written: result.rowsWritten,
            query_duration_ms: duration,
          },
        })
      }

      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message || 'Query execution failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  /**
   * V2/V3 API: Handle pipeline requests with stateful streams
   */
  private async handlePipeline(request: Request): Promise<Response> {
    let body: PipelineRequest

    try {
      body = await request.json()
    } catch (parseError: any) {
      console.error('[LibSQL HTTP] Failed to parse request body:', parseError.message)
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      // baton might not be present in the request body, default to null
      const baton = body.baton !== undefined ? body.baton : null
      const requests = body.requests

      if (!requests || !Array.isArray(requests)) {
        return new Response(JSON.stringify({ error: 'Invalid request: requests array required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Get or create stream
      let stream: StreamState
      let newBaton: string

      if (baton === null || baton === undefined) {
        // Create new stream
        newBaton = this.generateBaton()
        stream = new StreamState()
        this.streams.set(newBaton, stream)
        this.resetStreamTimeout(newBaton)
      } else {
        // Use existing stream
        const existingStream = this.streams.get(baton)
        if (!existingStream) {
          return new Response(JSON.stringify({ error: 'Invalid or expired baton' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        stream = existingStream
        // Generate new baton for next request
        newBaton = this.generateBaton()
        this.streams.delete(baton)
        this.streams.set(newBaton, stream)
        this.resetStreamTimeout(newBaton)
      }

      // Execute all requests
      const results: StreamResult[] = []

      for (let i = 0; i < requests.length; i++) {
        const req = requests[i]
        try {
          const response = await this.handleStreamRequest(req as StreamRequest, stream)
          results.push({ type: 'ok', response })
        } catch (error: any) {
          console.error(`[LibSQL HTTP] Request ${i + 1} failed:`, error.message)
          results.push({
            type: 'error',
            error: { message: error.message || 'Request failed' },
          })
        }
      }

      const response: PipelineResponse = {
        baton: newBaton,
        base_url: null, // Could be set for sticky routing
        results,
      }

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      console.error('[LibSQL HTTP] V2 Pipeline error:', error)
      console.error('[LibSQL HTTP] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
      return new Response(JSON.stringify({ error: error.message || 'Pipeline execution failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  /**
   * Handle individual stream request
   */
  private async handleStreamRequest(
    request: StreamRequest,
    stream: StreamState
  ): Promise<StreamResponse> {
    switch (request.type) {
      case 'close':
        return { type: 'close' }

      case 'execute':
        return await this.handleExecute(request, stream)

      case 'batch':
        return await this.handleBatch(request, stream)

      case 'sequence':
        return await this.handleSequence(request, stream)

      case 'describe':
        return await this.handleDescribe(request, stream)

      case 'store_sql':
        stream.storedSql.set(request.sql_id, request.sql)
        return { type: 'store_sql' }

      case 'close_sql':
        stream.storedSql.delete(request.sql_id)
        return { type: 'close_sql' }

      case 'get_autocommit':
        // Durable Objects are always in autocommit mode (no manual transactions)
        return { type: 'get_autocommit', is_autocommit: true }

      default:
        throw new Error(`Unknown request type: ${(request as any).type}`)
    }
  }

  /**
   * Execute a single statement
   */
  private async handleExecute(
    request: ExecuteStreamReq,
    stream: StreamState
  ): Promise<ExecuteStreamResp> {
    const stmt = request.stmt
    const sql = this.resolveSql(stmt, stream)

    // Parse args to handle Hrana format
    const parsedArgs = this.parseArgs(stmt.args)
    const parsedNamedArgs = this.parseNamedArgs(stmt.named_args)

    const result = await this.executeStatement(sql, parsedArgs, parsedNamedArgs)

    return {
      type: 'execute',
      result,
    }
  }

  /**
   * Execute a batch of statements
   */
  private async handleBatch(
    request: BatchStreamReq,
    stream: StreamState
  ): Promise<BatchStreamResp> {
    const batch = request.batch
    const stepResults: (StmtResult | null)[] = []
    const stepErrors: ({ message: string } | null)[] = []

    for (let i = 0; i < batch.steps.length; i++) {
      const step = batch.steps[i]

      // Check condition
      if (step?.condition && !this.evaluateCondition(step.condition, stepResults, stepErrors)) {
        stepResults.push(null)
        stepErrors.push(null)
        continue
      }

      try {
        if (!step?.stmt) {
          throw new Error('Step statement is undefined')
        }
        const sql = this.resolveSql(step.stmt, stream)
        // Parse args to handle Hrana format
        const parsedArgs = this.parseArgs(step.stmt.args)
        const parsedNamedArgs = this.parseNamedArgs(step.stmt.named_args)
        const result = await this.executeStatement(sql, parsedArgs, parsedNamedArgs)
        stepResults.push(result)
        stepErrors.push(null)
      } catch (error: any) {
        stepResults.push(null)
        stepErrors.push({ message: error.message || 'Execution failed' })
      }
    }

    return {
      type: 'batch',
      result: {
        step_results: stepResults,
        step_errors: stepErrors,
      },
    }
  }

  /**
   * Execute a sequence of SQL statements
   */
  private async handleSequence(
    request: SequenceStreamReq,
    stream: StreamState
  ): Promise<SequenceStreamResp> {
    const sql =
      request.sql_id !== null && request.sql_id !== undefined
        ? stream.storedSql.get(request.sql_id)
        : request.sql

    if (!sql) {
      throw new Error('SQL not provided and sql_id not found')
    }

    // Execute the SQL (may contain multiple statements separated by semicolons)
    this.sql.exec(sql)

    return { type: 'sequence' }
  }

  /**
   * Describe a statement
   */
  private async handleDescribe(
    request: DescribeStreamReq,
    stream: StreamState
  ): Promise<DescribeStreamResp> {
    const sql =
      request.sql_id !== null && request.sql_id !== undefined
        ? stream.storedSql.get(request.sql_id)
        : request.sql

    if (!sql) {
      throw new Error('SQL not provided and sql_id not found')
    }

    // For SQLite in DO, we'll return a basic description
    // In a full implementation, you'd use PRAGMA or EXPLAIN
    const isExplain = sql.trim().toUpperCase().startsWith('EXPLAIN')
    const isReadonly = this.isReadonlyQuery(sql)

    return {
      type: 'describe',
      result: {
        params: [], // Would need SQL parsing to determine parameters
        cols: [], // Would need to execute or analyze to get columns
        is_explain: isExplain,
        is_readonly: isReadonly,
      },
    }
  }

  /**
   * Execute a query (V1 format)
   */
  private async executeQuery(query: Query): Promise<{
    columns: string[]
    rows: SqlValue[][]
    rowsRead: number
    rowsWritten: number
  }> {
    let sql: string
    let params: SqlValue[] = []

    if (typeof query === 'string') {
      sql = query
    } else {
      sql = query.q
      params = this.normalizeParams(query.params)
    }

    const result = this.sql.exec(sql, ...params)
    const rows = result.toArray()

    // Get column names from first row if available
    const columns = rows.length > 0 ? Object.keys(rows[0]) : []

    // Convert rows to array of arrays
    const rowArrays = rows.map((row: any) => columns.map((col) => this.convertToSqlValue(row[col])))

    return {
      columns,
      rows: rowArrays,
      rowsRead: rows.length,
      rowsWritten: this.isWriteQuery(sql) ? 1 : 0,
    }
  }

  /**
   * Execute a statement (V2/V3 format)
   */
  private async executeStatement(
    sql: string,
    args?: SqlValue[],
    namedArgs?: Record<string, SqlValue>
  ): Promise<StmtResult> {
    const trimmedSql = sql.trim().toUpperCase()
    const startTime = performance.now()

    // Intercept transaction statements - Durable Objects handle transactions automatically
    // We'll silently succeed for BEGIN/COMMIT/ROLLBACK to maintain compatibility
    if (
      trimmedSql === 'BEGIN' ||
      trimmedSql === 'COMMIT' ||
      trimmedSql === 'ROLLBACK' ||
      trimmedSql.startsWith('BEGIN DEFERRED') ||
      trimmedSql.startsWith('BEGIN IMMEDIATE') ||
      trimmedSql.startsWith('BEGIN EXCLUSIVE') ||
      trimmedSql === 'SAVEPOINT' ||
      trimmedSql.startsWith('SAVEPOINT ') ||
      trimmedSql.startsWith('RELEASE ')
    ) {
      // Return empty result for transaction control statements
      const result: StmtResult = {
        cols: [],
        rows: [],
        affected_row_count: 0,
        last_insert_rowid: null,
      }

      // Add v3 metadata if needed
      if (this.protocolVersion === 3) {
        result.rows_read = 0
        result.rows_written = 0
        result.query_duration_ms = performance.now() - startTime
      }

      return result
    }

    const params = args || this.namedArgsToArray(sql, namedArgs || {})
    const result = this.sql.exec(sql, ...params)
    const rows = result.toArray()

    const cols =
      rows.length > 0 ? Object.keys(rows[0]).map((name) => ({ name, decltype: null })) : []

    // Convert rows to Hrana value format
    const rowArrays = rows.map((row: any) =>
      cols.map((col) => this.convertToHranaValue(row[col.name]))
    )

    // Get last insert rowid if it's an INSERT
    let lastInsertRowid: string | null = null
    if (trimmedSql.startsWith('INSERT')) {
      try {
        const idResult = this.sql.exec('SELECT last_insert_rowid() as id').toArray()[0]
        lastInsertRowid = String(idResult?.id || null)
      } catch {
        // Ignore errors
      }
    }

    const queryDuration = performance.now() - startTime
    const isWrite = this.isWriteQuery(sql)

    const stmtResult: StmtResult = {
      cols,
      rows: rowArrays,
      affected_row_count: isWrite ? 1 : 0,
      last_insert_rowid: lastInsertRowid,
    }

    // Add v3-specific metadata
    if (this.protocolVersion === 3) {
      stmtResult.rows_read = rows.length
      stmtResult.rows_written = isWrite ? 1 : 0
      stmtResult.query_duration_ms = queryDuration
    }

    return stmtResult
  }

  /**
   * Resolve SQL from statement (either direct sql or sql_id)
   */
  private resolveSql(stmt: Stmt, stream: StreamState): string {
    if (stmt.sql) {
      return stmt.sql
    }
    if (stmt.sql_id !== undefined && stmt.sql_id !== null) {
      const sql = stream.storedSql.get(stmt.sql_id)
      if (!sql) {
        throw new Error(`SQL ID ${stmt.sql_id} not found`)
      }
      return sql
    }
    throw new Error('Neither sql nor sql_id provided')
  }

  /**
   * Normalize params from record or array to array
   */
  private normalizeParams(params: Record<string, SqlValue> | SqlValue[] | undefined): SqlValue[] {
    if (!params) return []
    if (Array.isArray(params)) return params
    // For named params, we'd need to parse the SQL to map them correctly
    // For now, just return the values in order
    return Object.values(params)
  }

  /**
   * Convert named args to positional array based on SQL
   */
  private namedArgsToArray(sql: string, namedArgs: Record<string, SqlValue>): SqlValue[] {
    // Simple implementation: extract ? placeholders and map from named args
    // In a full implementation, you'd parse :name, @name, $name parameters
    const placeholders = sql.match(/\?/g)
    if (!placeholders) return []

    // For now, just return values in order (should parse SQL properly)
    return Object.values(namedArgs)
  }

  /**
   * Evaluate batch condition
   */
  private evaluateCondition(
    cond: BatchCond,
    results: (StmtResult | null)[],
    errors: ({ message: string } | null)[]
  ): boolean {
    if (cond.type === 'not' && cond.cond) {
      return !this.evaluateCondition(cond.cond, results, errors)
    }

    if (cond.step === undefined) return true

    if (cond.type === 'ok') {
      return errors[cond.step] === null
    }

    if (cond.type === 'error') {
      return errors[cond.step] !== null
    }

    return true
  }

  /**
   * Convert value to SQLite value (raw format for V1 API)
   */
  private convertToSqlValue(value: any): SqlValue {
    if (value === null || value === undefined) return null
    if (typeof value === 'string') return value
    if (typeof value === 'number') return value
    if (value instanceof Uint8Array) {
      return { base64: btoa(String.fromCharCode(...value)) }
    }
    return String(value)
  }

  /**
   * Convert value to Hrana value format (for V2 API responses)
   */
  private convertToHranaValue(value: any): HranaValue | null {
    if (value === null || value === undefined) {
      return { type: 'null' }
    }
    if (typeof value === 'string') {
      return { type: 'text', value }
    }
    if (typeof value === 'number') {
      // SQLite uses integers for whole numbers
      if (Number.isInteger(value)) {
        return { type: 'integer', value: value.toString() }
      }
      return { type: 'float', value }
    }
    if (value instanceof Uint8Array) {
      return {
        type: 'blob',
        value: btoa(String.fromCharCode(...value)),
      }
    }
    // Fallback: convert to text
    return { type: 'text', value: String(value) }
  }

  /**
   * Check if query is a write operation
   */
  private isWriteQuery(sql: string): boolean {
    const upper = sql.trim().toUpperCase()
    return (
      upper.startsWith('INSERT') ||
      upper.startsWith('UPDATE') ||
      upper.startsWith('DELETE') ||
      upper.startsWith('CREATE') ||
      upper.startsWith('DROP') ||
      upper.startsWith('ALTER')
    )
  }

  /**
   * Check if query is readonly
   */
  private isReadonlyQuery(sql: string): boolean {
    return !this.isWriteQuery(sql)
  }

  /**
   * Generate a cryptographically secure baton
   */
  private generateBaton(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Reset stream timeout
   */
  private resetStreamTimeout(baton: string): void {
    // Clear existing timeout
    const existingTimeout = this.streamTimeouts.get(baton)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.streams.delete(baton)
      this.streamTimeouts.delete(baton)
    }, this.STREAM_TIMEOUT_MS) as any

    this.streamTimeouts.set(baton, timeout)
  }
}

/**
 * Stream state for V2 API
 */
class StreamState {
  storedSql: Map<number, string> = new Map()
}
