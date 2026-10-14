export class ApiError extends Error {
  constructor(message, { code, hint, status } = {}) {
    super(message);
    this.code = code;
    this.hint = hint;
    this.status = status;
  }
}

async function request(path, options) {
  let res;
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new ApiError('Cannot reach the OLAP server.', {
      code: 'SERVER_DOWN',
      hint: 'Start the app with npm run dev from the olap-app folder.',
    });
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    // not JSON
  }

  if (!res.ok) {
    if (body && body.error) throw new ApiError(body.error.message, { ...body.error, status: res.status });
    throw new ApiError('The OLAP server is not responding.', {
      code: 'SERVER_DOWN',
      hint: 'Start the app with npm run dev from the olap-app folder.',
      status: res.status,
    });
  }
  return body;
}

export const getHealth = () => request('/api/health');
export const getReports = () => request('/api/reports');
export const getLookup = (name) => request(`/api/lookups/${encodeURIComponent(name)}`);
export const runReport = (id, payload) =>
  request(`/api/reports/${encodeURIComponent(id)}/run`, { method: 'POST', body: JSON.stringify(payload) });
