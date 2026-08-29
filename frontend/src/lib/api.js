const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '')
).replace(/\/$/, '');

async function request(path, options = {}) {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured for this deployment.');
  }
  const { token, headers, ...fetchOptions } = options;
  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export const api = {
  config: () => request('/config'),
  createRoom: (input = {}) => request('/rooms', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getRoom: (code) => request(`/rooms/${encodeURIComponent(code)}`),
  nonce: (roomCode, address) => request('/auth/nonce', {
    method: 'POST',
    body: JSON.stringify({ roomCode, address }),
  }),
  joinRoom: (code, input) => request(`/rooms/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  startRoom: (code, token) => request(`/rooms/${encodeURIComponent(code)}/start`, {
    method: 'POST',
    token,
  }),
  settlement: (code) => request(`/rooms/${encodeURIComponent(code)}/settlement`),
};

export function websocketUrl(roomCode, token) {
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  const base = explicit || API_URL.replace(/^http/, 'ws');
  if (!base) throw new Error('NEXT_PUBLIC_WS_URL is not configured for this deployment.');
  return `${base.replace(/\/$/, '')}/ws?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token)}`;
}
