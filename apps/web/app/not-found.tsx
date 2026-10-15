import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFoundPage() {
  return (
    <main className="z-missing">
      <div className="missing-layout">
        <h1>Page unavailable.</h1>
        <Link className="button primary" href="/">
          Zenith <ArrowRight size={16} />
        </Link>
      </div>
    </main>
  );
}
