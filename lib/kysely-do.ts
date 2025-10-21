/* eslint-disable require-yield */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  CompiledQuery,
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type Driver,
  type QueryCompiler,
  type QueryResult,
} from 'kysely'

export interface DODialectConfig {
  ctx: DurableObjectState
}

export class DODialect implements Dialect {
  #config: DODialectConfig

  constructor(config: DODialectConfig) {
    this.#config = config
  }

  createAdapter() {
    return new SqliteAdapter()
  }

  createDriver(): Driver {
    return new DODriver(this.#config)
  }

  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler()
  }

  createIntrospector(db: Kysely<unknown>): DatabaseIntrospector {
    return new SqliteIntrospector(db)
  }
}

class DODriver implements Driver {
  #config: DODialectConfig

  constructor(config: DODialectConfig) {
    this.#config = config
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return new DOConnection(this.#config)
  }

  async beginTransaction(conn: DOConnection): Promise<void> {
    return await conn.beginTransaction()
  }

  async commitTransaction(conn: DOConnection): Promise<void> {
    return await conn.commitTransaction()
  }

  async rollbackTransaction(conn: DOConnection): Promise<void> {
    return await conn.rollbackTransaction()
  }

  async releaseConnection(_conn: DOConnection): Promise<void> {}

  async destroy(): Promise<void> {}
}

class DOConnection implements DatabaseConnection {
  #config: DODialectConfig

  constructor(config: DODialectConfig) {
    this.#config = config
  }

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const cursor = this.#config.ctx.storage.sql.exec(compiledQuery.sql, ...compiledQuery.parameters)

    const rows = cursor.toArray() as O[]

    const numAffectedRows = cursor.rowsWritten > 0 ? BigInt(cursor.rowsWritten) : undefined

    return {
      insertId: undefined,
      rows: rows || [],
      numAffectedRows,
    }
  }

  async beginTransaction() {
    throw new Error('Transactions are not supported yet.')
  }

  async commitTransaction() {
    throw new Error('Transactions are not supported yet.')
  }

  async rollbackTransaction() {
    throw new Error('Transactions are not supported yet.')
  }

  async *streamQuery<O>(
    _compiledQuery: CompiledQuery,
    _chunkSize: number
  ): AsyncIterableIterator<QueryResult<O>> {
    throw new Error('DO Driver does not support streaming')
  }
}
