function encode(type, payload = {}) {
  return JSON.stringify({ type, ...payload });
}

function send(socket, type, payload) {
  if (socket.readyState === socket.OPEN) socket.send(encode(type, payload));
}

module.exports = { encode, send };
