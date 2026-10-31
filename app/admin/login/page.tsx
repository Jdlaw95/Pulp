"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Login successful, redirect to dashboard
      router.push("/admin");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-pulp-bg px-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-sm border border-pulp-border">
        <h1 className="text-3xl font-serif text-center mb-2">Pulp</h1>
        <p className="text-center text-gray-500 font-sans text-sm mb-8 tracking-widest uppercase">Admin Portal</p>
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email address"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border border-pulp-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pulp-text"
          />
          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border border-pulp-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pulp-text"
          />
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pulp-text text-pulp-bg py-3 rounded-full font-sans tracking-widest uppercase text-sm mt-2 disabled:opacity-50 hover:bg-black transition-colors"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}