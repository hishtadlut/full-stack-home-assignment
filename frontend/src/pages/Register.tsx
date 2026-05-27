import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

export const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    name: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { register } = useAuth();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await register({
        ...formData,
        name: formData.name.trim() || undefined,
      });
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-zinc-50 text-zinc-950 lg:grid-cols-[minmax(0,1fr)_30rem]">
      <section className="flex min-h-[18rem] items-center border-b border-zinc-200 bg-white px-6 py-10 lg:border-b-0 lg:border-r lg:px-12">
        <div className="max-w-2xl">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded bg-emerald-50 text-emerald-700">
            <ClipboardList className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-normal">Create your workspace</h1>
        </div>
      </section>

      <section className="flex items-center px-6 py-10">
        <div className="w-full rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Register</h2>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              autoComplete="email"
              onChange={handleChange}
            />
            <Field
              label="Username"
              name="username"
              value={formData.username}
              autoComplete="username"
              onChange={handleChange}
            />
            <Field
              label="Name"
              name="name"
              value={formData.name}
              autoComplete="name"
              required={false}
              onChange={handleChange}
            />
            <Field
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              autoComplete="new-password"
              onChange={handleChange}
            />

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
              Register
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-zinc-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-cyan-700 hover:text-cyan-900 underline">
              Login here
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
};

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  autoComplete: string;
  required?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const Field = ({
  label,
  name,
  type = 'text',
  value,
  autoComplete,
  required = true,
  onChange,
}: FieldProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-semibold text-zinc-700">{label}</label>
    <input
      id={name}
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      required={required}
      className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
    />
  </div>
);
