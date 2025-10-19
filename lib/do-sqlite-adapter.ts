/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdapterFactory, type AdapterDebugLogs } from 'better-auth/adapters'

/**
 * Configuration options for the Durable Object SQLite adapter
 */
export interface DurableObjectSQLiteAdapterConfig {
  /**
   * Helps you debug issues with the adapter.
   */
  debugLogs?: AdapterDebugLogs
  /**
   * If the table names in the schema are plural.
   */
  usePlural?: boolean
}

/**
 * Better Auth adapter for Cloudflare Durable Objects SQLite
 *
 * This adapter provides a bridge between Better Auth's database operations
 * and Cloudflare Durable Objects' SQL storage API.
 *
 * @param sql - The Durable Object SQL storage instance
 * @param config - Optional configuration for the adapter
 *
 * @example
 * ```typescript
 * import { durableObjectSQLiteAdapter } from "./do-sqlite-adapter";
 * import { betterAuth } from "better-auth";
 *
 * export class AuthDO extends DurableObject {
 *   protected sql = this.ctx.storage.sql;
 *
 *   protected getAuth(baseURL: string) {
 *     return betterAuth({
 *       database: durableObjectSQLiteAdapter(this.sql),
 *       baseURL,
 *     });
 *   }
 * }
 * ```
 */
export const durableObjectSQLiteAdapter = (
  sql: any,
  config: DurableObjectSQLiteAdapterConfig = {}
) =>
  createAdapterFactory({
    config: {
      adapterId: 'durable-object-sqlite',
      adapterName: 'Durable Object SQLite',
      usePlural: config.usePlural ?? false,
      debugLogs: config.debugLogs ?? false,
      supportsJSON: false, // SQLite doesn't natively support JSON
      supportsDates: false, // We use timestamps (integers) instead
      supportsBooleans: false, // We use integers (0/1) instead
      supportsNumericIds: false, // We use text/uuid IDs
    },
    adapter: ({ schema, debugLog, getDefaultModelName }) => {
      /**
       * Convert camelCase to snake_case for database column names
       */
      const toSnakeCase = (str: string): string => {
        return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
      }

      /**
       * Convert snake_case to camelCase for JavaScript field names
       */
      const toCamelCase = (str: string): string => {
        return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      }

      /**
       * Transform data for input (before saving to DB)
       * - Convert Date objects to timestamps
       * - Convert booleans to integers (0/1)
       * - Handle null values
       * - Convert field names from camelCase to snake_case
       */
      const transformInput = (data: Record<string, any>): Record<string, any> => {
        const transformed: Record<string, any> = {}

        for (const [key, value] of Object.entries(data)) {
          if (value === undefined) continue

          const dbKey = toSnakeCase(key) // Convert camelCase to snake_case

          if (value === null) {
            transformed[dbKey] = null
          } else if (value instanceof Date) {
            transformed[dbKey] = value.getTime()
          } else if (typeof value === 'boolean') {
            transformed[dbKey] = value ? 1 : 0
          } else {
            transformed[dbKey] = value
          }
        }

        return transformed
      }

      /**
       * Transform data for output (after reading from DB)
       * - Convert timestamps to Date objects for createdAt, updatedAt, expiresAt
       * - Convert integers to booleans for emailVerified, twoFactorEnabled, etc.
       * - Convert field names from snake_case to camelCase
       */
      const transformOutput = (data: Record<string, any>, model: string): Record<string, any> => {
        if (!data) return data

        const transformed: Record<string, any> = {}
        const modelSchema = schema[model]

        for (const [key, value] of Object.entries(data)) {
          const camelKey = toCamelCase(key) // Convert snake_case to camelCase
          const field = modelSchema?.fields?.[camelKey]

          if (value === null || value === undefined) {
            transformed[camelKey] = value
          } else if (field?.type === 'date' || camelKey.match(/At$/)) {
            // Convert timestamp to Date
            transformed[camelKey] = new Date(value as number)
          } else if (field?.type === 'boolean' || camelKey.match(/verified|enabled|backed_up/i)) {
            // Convert integer to boolean
            transformed[camelKey] = Boolean(value)
          } else {
            transformed[camelKey] = value
          }
        }

        return transformed
      }

      /**
       * Build WHERE clause from conditions
       * Handles both object format { field: value } and array format [{ field, operator, value, connector }]
       */
      const buildWhereClause = (where: any): { clause: string; values: any[] } => {
        const conditions: string[] = []
        const values: any[] = []

        // Check if where is an array (Better Auth format)
        if (Array.isArray(where)) {
          const conditionParts: string[] = []

          for (let i = 0; i < where.length; i++) {
            const { field, operator = 'eq', value, connector = 'AND' } = where[i]
            const dbField = toSnakeCase(field) // Convert camelCase to snake_case

            // Transform the value for SQLite
            const transformValue = (val: any) => {
              if (val instanceof Date) {
                return val.getTime()
              } else if (typeof val === 'boolean') {
                return val ? 1 : 0
              }
              return val
            }

            // Build condition based on operator
            let conditionStr = ''
            if (value === null) {
              conditionStr = `${dbField} IS NULL`
            } else if (operator === 'eq') {
              conditionStr = `${dbField} = ?`
              values.push(transformValue(value))
            } else if (operator === 'ne') {
              conditionStr = `${dbField} != ?`
              values.push(transformValue(value))
            } else if (operator === 'lt') {
              conditionStr = `${dbField} < ?`
              values.push(transformValue(value))
            } else if (operator === 'lte') {
              conditionStr = `${dbField} <= ?`
              values.push(transformValue(value))
            } else if (operator === 'gt') {
              conditionStr = `${dbField} > ?`
              values.push(transformValue(value))
            } else if (operator === 'gte') {
              conditionStr = `${dbField} >= ?`
              values.push(transformValue(value))
            } else if (operator === 'in') {
              const list = Array.isArray(value) ? value : [value]
              const placeholders = list.map(() => '?').join(', ')
              conditionStr = `${dbField} IN (${placeholders})`
              values.push(...list.map(transformValue))
            } else if (operator === 'not_in') {
              const list = Array.isArray(value) ? value : [value]
              const placeholders = list.map(() => '?').join(', ')
              conditionStr = `${dbField} NOT IN (${placeholders})`
              values.push(...list.map(transformValue))
            } else if (operator === 'contains') {
              conditionStr = `${dbField} LIKE ?`
              values.push(`%${value}%`)
            } else if (operator === 'starts_with') {
              conditionStr = `${dbField} LIKE ?`
              values.push(`${value}%`)
            } else if (operator === 'ends_with') {
              conditionStr = `${dbField} LIKE ?`
              values.push(`%${value}`)
            }

            // Add connector for conditions after the first one
            if (i > 0) {
              conditionParts.push(`${connector} ${conditionStr}`)
            } else {
              conditionParts.push(conditionStr)
            }
          }

          return {
            clause: conditionParts.length > 0 ? `WHERE ${conditionParts.join(' ')}` : '',
            values,
          }
        }

        // Handle object format (legacy support)
        for (const [key, value] of Object.entries(where)) {
          const dbKey = toSnakeCase(key) // Convert camelCase to snake_case

          if (value === null) {
            conditions.push(`${dbKey} IS NULL`)
          } else {
            conditions.push(`${dbKey} = ?`)
            // Transform the value for SQLite
            if (value instanceof Date) {
              values.push(value.getTime())
            } else if (typeof value === 'boolean') {
              values.push(value ? 1 : 0)
            } else {
              values.push(value)
            }
          }
        }

        return {
          clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
          values,
        }
      }

      /**
       * Apply select fields to result
       */
      const applySelect = (data: any, select?: string[]) => {
        if (!data || !select || select.length === 0) return data

        if (Array.isArray(data)) {
          return data.map((item) => {
            const selected: Record<string, any> = {}
            for (const field of select) {
              selected[field] = item[field]
            }
            return selected
          })
        }

        const selected: Record<string, any> = {}
        for (const field of select) {
          selected[field] = data[field]
        }
        return selected
      }

      return {
        /**
         * Create a new record
         */
        create: async ({ model, data, select }) => {
          debugLog(`[DO-SQLite] Creating ${model}:`, data)

          const tableName = getDefaultModelName(model)
          const transformedData = transformInput(data)
          const keys = Object.keys(transformedData)
          const values = Object.values(transformedData)
          const placeholders = keys.map(() => '?').join(', ')

          const query = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`

          debugLog(`[DO-SQLite] Query:`, query)

          sql.exec(query, ...values)

          // Fetch the created record
          const result = sql.exec(`SELECT * FROM ${tableName} WHERE id = ?`, data.id).toArray()[0]

          const transformed = transformOutput(result, model)
          return applySelect(transformed, select)
        },

        /**
         * Find a single record
         */
        findOne: async ({ model, where, select }) => {
          debugLog(`[DO-SQLite] Finding one ${model}:`, where)

          const tableName = getDefaultModelName(model)
          const { clause, values } = buildWhereClause(where)
          debugLog(`[DO-SQLite] Finding one ${model}:`, clause, values)
          const query = `SELECT * FROM ${tableName} ${clause} LIMIT 1`

          debugLog(`[DO-SQLite] Query:`, query)

          const result = sql.exec(query, ...values).toArray()[0]

          if (!result) return null

          const transformed = transformOutput(result, model)
          return applySelect(transformed, select)
        },

        /**
         * Find multiple records
         */
        findMany: async ({ model, where, limit, offset, sortBy }) => {
          debugLog(`[DO-SQLite] Finding many ${model}:`, { where, limit, offset, sortBy })

          const tableName = getDefaultModelName(model)
          let query = `SELECT * FROM ${tableName}`
          const values: any[] = []

          if (where && Object.keys(where).length > 0) {
            const { clause, values: whereValues } = buildWhereClause(where)
            query += ` ${clause}`
            values.push(...whereValues)
          }

          if (sortBy) {
            const orderClauses = Object.entries(sortBy).map(
              ([field, direction]) => `${field} ${direction === 'asc' ? 'ASC' : 'DESC'}`
            )
            query += ` ORDER BY ${orderClauses.join(', ')}`
          }

          if (limit !== undefined) {
            query += ` LIMIT ${limit}`
          }

          if (offset !== undefined) {
            query += ` OFFSET ${offset}`
          }

          debugLog(`[DO-SQLite] Query:`, query)

          const results = sql.exec(query, ...values).toArray()

          const transformed = results.map((row: any) => transformOutput(row, model))
          return transformed
        },

        /**
         * Update a single record
         */
        update: async ({ model, where, update }) => {
          debugLog(`[DO-SQLite] Updating ${model}:`, { where, update })

          const tableName = getDefaultModelName(model)
          const transformedUpdate = transformInput(update as Record<string, any>)
          const updateKeys = Object.keys(transformedUpdate)
          const updateValues = Object.values(transformedUpdate)

          const { clause, values: whereValues } = buildWhereClause(where)

          const setClause = updateKeys.map((key) => `${key} = ?`).join(', ')
          const query = `UPDATE ${tableName} SET ${setClause} ${clause}`

          debugLog(`[DO-SQLite] Query:`, query)

          sql.exec(query, ...updateValues, ...whereValues)

          // Fetch and return the updated record
          const result = sql
            .exec(`SELECT * FROM ${tableName} ${clause}`, ...whereValues)
            .toArray()[0]

          return result ? transformOutput(result, model) : (null as any)
        },

        /**
         * Update multiple records
         */
        updateMany: async ({ model, where, update }) => {
          debugLog(`[DO-SQLite] Updating many ${model}:`, { where, update })

          const tableName = getDefaultModelName(model)
          const transformedUpdate = transformInput(update)
          const updateKeys = Object.keys(transformedUpdate)
          const updateValues = Object.values(transformedUpdate)

          const { clause, values: whereValues } = buildWhereClause(where)

          const setClause = updateKeys.map((key) => `${key} = ?`).join(', ')
          const query = `UPDATE ${tableName} SET ${setClause} ${clause}`

          debugLog(`[DO-SQLite] Query:`, query)

          sql.exec(query, ...updateValues, ...whereValues)

          // Return count (SQLite doesn't provide this directly in DO, so we return 0)
          return 0
        },

        /**
         * Delete a single record
         */
        delete: async ({ model, where }) => {
          debugLog(`[DO-SQLite] Deleting ${model}:`, where)

          const tableName = getDefaultModelName(model)
          const { clause, values } = buildWhereClause(where)

          const query = `DELETE FROM ${tableName} ${clause}`

          debugLog(`[DO-SQLite] Query:`, query)

          sql.exec(query, ...values)
        },

        /**
         * Delete multiple records
         */
        deleteMany: async ({ model, where }) => {
          debugLog(`[DO-SQLite] Deleting many ${model}:`, where)

          const tableName = getDefaultModelName(model)
          const { clause, values } = buildWhereClause(where)

          const query = `DELETE FROM ${tableName} ${clause}`

          debugLog(`[DO-SQLite] Query:`, query)

          sql.exec(query, ...values)

          // Return count (SQLite doesn't provide this directly in DO, so we return 0)
          return 0
        },

        /**
         * Count records
         */
        count: async ({ model, where }) => {
          debugLog(`[DO-SQLite] Counting ${model}:`, where)

          const tableName = getDefaultModelName(model)
          let query = `SELECT COUNT(*) as count FROM ${tableName}`
          const values: any[] = []

          if (where && Object.keys(where).length > 0) {
            const { clause, values: whereValues } = buildWhereClause(where)
            query += ` ${clause}`
            values.push(...whereValues)
          }

          debugLog(`[DO-SQLite] Query:`, query)

          const result = sql.exec(query, ...values).toArray()[0] as { count: number }
          return result.count
        },
      }
    },
  })
