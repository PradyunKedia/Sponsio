export default function Landing({ onStart }) {
  return (
    <div className="landing">
      <div className="logo-block screen-enter">
        <div className="logo-slant">SPONSIO</div>
        <span className="logo-sub">PEER COORDINATION ARENA</span>
        <div className="logo-platform screen-enter d1">
          <span className="on">● LIVE</span>
          <span className="gold">100 SECONDS</span>
          <span>MONAD</span>
        </div>
      </div>

      <div className="start-wrap screen-enter d2">
        <button className="btn-arcade blink" onClick={onStart}>
          ▶ START ARENA
        </button>
        <div className="press-hint">INSERT 1 COIN TO PLAY</div>
      </div>

      <div className="landing-feet">
        <span>INSERT COIN</span>
        <span>FREE TO PLAY</span>
        <span>© SPONSIO</span>
      </div>
    </div>
  );
}
