import Link from "next/link";
import { ArrowUpRight, Camera, UserRound, ShieldCheck } from "lucide-react";
import { BrandHeader, Reels, Wordmark, Footer } from "@/components/brand";
export default function Home() {
  return (
    <div className="landing">
      <BrandHeader />
      <Reels />
      <main className="hero">
        <div className="eyebrow">
          <Camera size={16} /> PHOTOGRAPHY WORKSHOP & COMPETITION
        </div>
        <h1>
          <Wordmark />
        </h1>
        <h2>Capture, Create, Captivate</h2>
        <p className="hero-tagline">
          Because the best stories exist outside the frame
        </p>
        <div className="hero-actions">
          <Link className="button primary" href="/register">
            <UserRound size={19} />
            Register as Student
            <ArrowUpRight size={18} />
          </Link>
          <Link className="button secondary" href="/admin">
            <ShieldCheck size={19} />
            Register as Admin
          </Link>
          <Link className="button dashed" href="/login">
            <span>
              Login as Student<small>Already registered? Step right in.</small>
            </span>
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="hero-note">
          <span className="hairline" />
          YOUR PERSPECTIVE. YOUR FRAME.
          <span className="hairline" />
        </div>
      </main>
      <Footer />
    </div>
  );
}
