import Link from "next/link";
export default function NotFound() {
  return (
    <main className="loading-page">
      <p className="eyebrow">OUTSIDE THE FRAME</p>
      <h1>This page wandered off.</h1>
      <Link className="button primary" href="/">
        Back to OffFrame
      </Link>
    </main>
  );
}
