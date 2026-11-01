"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserDb } from "../../lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // The server sends people back here with a reason when a signed-in account is turned away.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "not-allowed") setError("You are signed in, but this email is not on the admin list. Check ADMIN_EMAILS in your environment settings.");
    if (reason === "session") setError("Your session was not recognised. Please log in again.");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await browserDb().auth.signInWithPassword({ email, password });
    if (error) {
      setError("Those details did not work. Please try again.");
      setLoading(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-pulp-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-pulp-border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center font-serif text-3xl">Pulp</h1>
        <p className="mb-8 text-center text-sm uppercase tracking-widest text-gray-500">Admin</p>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input type="email" placeholder="Email address" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-pulp-border bg-white p-3 outline-none focus:ring-2 focus:ring-pulp-text" />
          <input type="password" placeholder="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-pulp-border bg-white p-3 outline-none focus:ring-2 focus:ring-pulp-text" />
          {error && <p role="alert" className="text-center text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="mt-2 w-full rounded-full bg-pulp-text py-3 text-sm uppercase tracking-widest text-pulp-bg transition hover:bg-black disabled:opacity-50">
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
