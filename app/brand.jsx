export default function Brand({ welcome = false }) {
  return (
    <span className={`brand${welcome ? ' brand-welcome' : ''}`}>
      <img className="brand-mark" src="/brand-mark.svg" width={welcome ? 72 : 40} height={welcome ? 72 : 40} alt="" />
      <span className="brand-type">
        <strong className="brand-wordmark">letsgetmarried</strong>
        {!welcome && <small className="brand-caption">성현과 지윤의 결혼 준비</small>}
      </span>
    </span>
  );
}
