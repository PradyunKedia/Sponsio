import { useEffect, useRef } from 'react';

// Classic arcade joystick, TOP-DOWN view: a black base plate with a red ball
// head that deflects dynamically based on mouse position or keyboard arrow keys.
// Purely decorative. Keypresses deflect in the corresponding direction.
export default function ArcadeConsole({ dir = 0 }) {
  const raf = useRef();

  useEffect(() => {
    let mouseOffset = 0;
    const activeKeys = new Set();

    const updateJoystick = () => {
      let dx = 0;
      let dy = 0;

      if (activeKeys.has('ArrowLeft')) dx -= 26;
      if (activeKeys.has('ArrowRight')) dx += 26;
      if (activeKeys.has('ArrowUp')) dy -= 26;
      if (activeKeys.has('ArrowDown')) dy += 26;

      // If no arrow keys are held, fall back to vertical mouse tracking
      if (dx === 0 && dy === 0) {
        dy = mouseOffset;
      }

      const el = document.querySelector('.joy-ball');
      if (el) {
        el.style.setProperty('--cursor-offset-x', `${dx}px`);
        el.style.setProperty('--cursor-offset-y', `${dy}px`);
      }
    };

    const onMove = (ev) => {
      const cy = window.innerHeight / 2;
      let y = (ev.clientY - cy) / cy; // -1..1
      y = Math.max(-1, Math.min(1, y));
      mouseOffset = y * 26;
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(updateJoystick);
    };

    const onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        activeKeys.add(e.key);
        updateJoystick();
      }
    };

    const onKeyUp = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        activeKeys.delete(e.key);
        updateJoystick();
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div className="joy" aria-hidden>
      <div className="joy-plate">
        <div className="joy-well-plate" />
        <div className={`joy-ball${dir === 1 ? ' flick-down' : dir === -1 ? ' flick-up' : ''}`} />
      </div>
    </div>
  );
}