import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container grid">
      <section className="panel">
        <h1 style={{ fontSize: "3rem" }}>NinjaDojo Control Center</h1>
        <p>TV display, Sensei dashboard, curriculum builder, and monthly progress report generation.</p>
        <div className="toolbar">
          <Link href="/tv" className="button">
            Open TV Dashboard
          </Link>
          <Link href="/dashboard" className="button secondary">
            Open Sensei Dashboard
          </Link>
          <Link href="/curriculum" className="button ghost">
            Curriculum Builder
          </Link>
          <Link href="/reports" className="button ghost">
            Reports
          </Link>
        </div>
      </section>
    </main>
  );
}
