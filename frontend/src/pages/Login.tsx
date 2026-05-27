import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-zinc-50 text-zinc-950 lg:grid-cols-[minmax(0,1fr)_28rem]">
      <section className="flex min-h-[18rem] items-center border-b border-zinc-200 bg-white px-6 py-10 lg:border-b-0 lg:border-r lg:px-12">
        <div className="max-w-2xl">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded bg-cyan-50 text-cyan-700">
            <ClipboardList className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-normal">Task Manager</h1>
        </div>
      </section>

      <section className="flex items-center px-6 py-10">
        <div className="w-full rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Login</h2>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-zinc-700">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-zinc-700">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                required
              />
            </div>

            {error && (
              <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              Login
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-zinc-600">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-cyan-700 hover:text-cyan-900 underline">
              Register here
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
};
