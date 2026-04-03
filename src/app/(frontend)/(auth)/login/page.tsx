import { LoginForm } from '@/features/auth-login/ui/_components/LoginForm';

type LoginPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function resolveRedirect(redirect: string | string[] | undefined): string {
  const value = Array.isArray(redirect) ? redirect[0] : redirect;
  if (value && value.startsWith('/')) {
    return value;
  }

  return '/dashboard';
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTarget = resolveRedirect(params.redirect);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-16">
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Owner login</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use the credentials created by an admin in Payload.
        </p>

        <LoginForm redirectTarget={redirectTarget} />
      </div>
    </main>
  );
}
