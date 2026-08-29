// Classic red 7-segment display. Renders digits 0-9, a colon, and a minus sign.
// Shape: each digit is a small grid with bars a..g (standard segment labals).

const SEG = {
  0: 'abcdef',
  1: 'bc',
  2: 'abged',
  3: 'abgcd',
  4: 'fgbc',
  5: 'afgcd',
  6: 'afgdec',
  7: 'abc',
  8: 'abcdefg',
  9: 'abcfgd',
};

function Digit({ ch }) {
  const bars = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const lit = SEG[ch] ?? '';
  return (
    <span className="digit">
      {bars.map((b) => (
        <span key={b} className={`seg seg-${b}${lit.includes(b) ? ' on' : ''}`} />
      ))}
    </span>
  );
}

export default function SevenSeg({ value, size }) {
  // e.g. value "MM:SS" or "100"
  const parts = String(value).split('');
  return (
    <span className="sevenseg" style={size != null ? { fontSize: `${size}rem` } : undefined}>
      {parts.map((ch, i) => {
        if (ch === ':') {
          return (
            <span key={i} className="colon on">
              <i /><i />
            </span>
          );
        }
        if (ch === '-') {
          return (
            <span key={i} className="digit">
              <span className={`seg seg-g on`} />
            </span>
          );
        }
        const d = ch.toUpperCase();
        // letters like X / M not on a 7-seg — blank out unknown with no bars
        return <Digit key={i} ch={d} />;
      })}
    </span>
  );
}