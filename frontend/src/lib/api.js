const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin)
).replace(/\/$/, '');

async function request(path, options = {}) {
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
  const explicit = import.meta.env.VITE_WS_URL;
  const base = explicit || API_URL.replace(/^http/, 'ws');
  return `${base.replace(/\/$/, '')}/ws?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token)}`;
}
