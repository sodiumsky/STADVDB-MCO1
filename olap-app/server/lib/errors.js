class AppError extends Error {
  constructor(status, message, { code, hint } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

const UNREACHABLE = new Set([
  'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET',
  'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_SEQUENCE_TIMEOUT',
]);

// Turns a thrown error into { status, error: { code, message, hint } } for the client.
function describeError(err) {
  if (err instanceof AppError) {
    return { status: err.status, error: { code: err.code, message: err.message, hint: err.hint } };
  }
  const code = err && err.code;
  if (UNREACHABLE.has(code) || (err && err.name === 'AggregateError')) {
    return {
      status: 503,
      error: {
        code: 'DB_UNREACHABLE',
        message: 'Cannot reach the MySQL server.',
        hint: 'Check that MySQL is running and that DB_HOST and DB_PORT in olap-app/.env are correct.',
      },
    };
  }
  if (code === 'ER_ACCESS_DENIED_ERROR') {
    return {
      status: 503,
      error: {
        code: 'DB_ACCESS_DENIED',
        message: 'MySQL rejected the username or password.',
        hint: 'Check DB_USER and DB_PASSWORD in olap-app/.env.',
      },
    };
  }
  if (code === 'ER_BAD_DB_ERROR') {
    return {
      status: 503,
      error: {
        code: 'DB_UNKNOWN_DATABASE',
        message: 'The database named in DB_NAME does not exist on this server.',
        hint: 'Check DB_NAME in olap-app/.env and that the warehouse is loaded.',
      },
    };
  }
  if (code === 'ER_NO_DB_ERROR') {
    return {
      status: 503,
      error: {
        code: 'DB_NOT_SELECTED',
        message: 'No database is selected.',
        hint: 'Set DB_NAME in olap-app/.env.',
      },
    };
  }
  if (err && err.sqlMessage) {
    // The team's SQL failed. Show MySQL's own message so it can be fixed.
    return {
      status: 400,
      error: { code: code || 'SQL_ERROR', message: err.sqlMessage, hint: 'Fix the query in olap-app/server/queries.js.' },
    };
  }
  return { status: 500, error: { code: 'INTERNAL', message: (err && err.message) || 'Unexpected server error.' } };
}

module.exports = { AppError, describeError };
