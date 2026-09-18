import Link from "next/link";
export function Wordmark({ className = "" }) {
  return (
    <span className={`wordmark ${className}`}>
      <span>Off</span>
      <span>Frame</span>
    </span>
  );
}
export function BrandHeader() {
  return (
    <header className="brand-header">
      <Link href="/" className="college-brand" aria-label="OffFrame home">
        <img src="/assets/college-logo.png" alt="GCETTS crest" />
        <div>
          <strong>
            Government College of Engineering and
            <br className="desktop-br" /> Textile Technology, Serampore
          </strong>
          <span>Department of Computer Science and Engineering</span>
        </div>
      </Link>
      <Link href="/" className="club-brand">
        <div>
          <img src="/assets/offframe-logo.png" alt="OffFrame club logo" />
          <Wordmark />
        </div>
        <small>The Photography Club of CSE GCETTS</small>
      </Link>
    </header>
  );
}
export function Reels() {
  return (
    <div className="reels" aria-hidden="true">
      <img className="reel-left" src="/assets/reel.png" alt="" />
      <img className="reel-right" src="/assets/reel.png" alt="" />
    </div>
  );
}
export function Footer() {
  return (
    <footer>
      <span>OffFrame · CSE GCETTS</span>
      <span>Made by <strong>Hardik Chakraborty</strong> & <strong>Anubhav Mondal</strong> (2nd Year)</span>
    </footer>
  );
}
