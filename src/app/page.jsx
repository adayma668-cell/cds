import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary-light via-background to-accent-light">
      <div className="w-full max-w-lg text-center space-y-8">
        <div className="flex justify-center">
          <img src="/logo.svg" alt="xLM" className="h-16" />
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            <span className="text-primary">c</span>
            <span className="text-accent">DS</span>
          </h1>
          <p className="text-sm font-semibold text-muted uppercase tracking-widest">
            Continuous Daily Standup
          </p>
          <p className="text-base text-muted max-w-md mx-auto leading-relaxed pt-1">
            Simplify your daily standups. Submit updates, track blockers, and
            keep your team in sync.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="w-full sm:w-auto rounded-lg bg-primary text-white px-8 py-3 text-sm font-semibold hover:bg-primary-dark transition-colors shadow-md shadow-primary/20"
          >
            Login
          </Link>
        </div>

        <p className="text-sm text-muted/70">
          Contact your admin to get an account
        </p>
      </div>
    </div>
  );
}
