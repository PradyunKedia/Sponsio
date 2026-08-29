import { useCallback, useEffect, useRef, useState } from 'react';
import { websocketUrl } from '../lib/api';

export default function useRoomSocket(roomCode, token, address) {
  const [room, setRoom] = useState(null);
  const [connection, setConnection] = useState('idle');
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const reconnectRef = useRef(0);
  const timerRef = useRef();
  const clientSeqRef = useRef(0);

  useEffect(() => {
    if (!roomCode || !token) return undefined;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setConnection(reconnectRef.current === 0 ? 'connecting' : 'reconnecting');
      const socket = new WebSocket(websocketUrl(roomCode, token));
      socketRef.current = socket;
      socket.onopen = () => {
        reconnectRef.current = 0;
        setConnection('connected');
        setError('');
      };
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'room_state') {
          setRoom(message.room);
          const me = message.room.players?.find((player) => player.address === address);
          if (me) clientSeqRef.current = Math.max(clientSeqRef.current, me.clientSeq || 0);
        } else if (message.type === 'tick') {
          setRoom((current) => current ? { ...current, ...message.room } : message.room);
        } else if (message.type === 'error') {
          setError(message.message);
        }
      };
      socket.onclose = (event) => {
        if (cancelled || event.code === 4001) return;
        setConnection('reconnecting');
        reconnectRef.current += 1;
        const delay = Math.min(10_000, 500 * (2 ** reconnectRef.current));
        timerRef.current = setTimeout(connect, delay);
      };
      socket.onerror = () => socket.close();
    };

    connect();
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      socketRef.current?.close();
    };
  }, [roomCode, token, address]);

  const switchProfile = useCallback((profileIndex) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      throw new Error('Connection is not ready');
    }
    clientSeqRef.current += 1;
    socketRef.current.send(JSON.stringify({
      type: 'switch',
      profileIndex,
      clientSeq: clientSeqRef.current,
    }));
  }, []);

  return { room, connection, error, clearError: () => setError(''), switchProfile };
}
