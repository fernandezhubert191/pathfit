import { Form, Head } from '@inertiajs/react';
import { KeyRound, Mail, ShieldCheck } from 'lucide-react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

export default function LoginCard({ status, canResetPassword }: Props) {
    return (
        <>
            <Head title="Admin Login" />

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-5"
            >
                {({ processing, errors }) => (
                    <>
                        {/* Admin badge */}
                        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-100">
                                <ShieldCheck className="size-4 text-white dark:text-zinc-900" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Administrator Portal</p>
                                <p className="text-xs text-muted-foreground">Authorized personnel only</p>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            {/* Email */}
                            <div className="grid gap-1.5">
                                <Label htmlFor="email" className="flex items-center gap-1.5">
                                    <Mail className="size-3.5 text-muted-foreground" />
                                    Admin email
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder="admin@example.com"
                                    className="h-11"
                                />
                                <InputError message={errors.email} />
                            </div>

                            {/* Password */}
                            <div className="grid gap-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="flex items-center gap-1.5">
                                        <KeyRound className="size-3.5 text-muted-foreground" />
                                        Password
                                    </Label>
                                    {canResetPassword && (
                                        <TextLink
                                            href={request()}
                                            className="text-xs text-muted-foreground hover:text-foreground"
                                            tabIndex={5}
                                        >
                                            Forgot password?
                                        </TextLink>
                                    )}
                                </div>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    className="h-11"
                                />
                                <InputError message={errors.password} />
                            </div>

                            {/* Remember me */}
                            <div className="flex items-center space-x-2.5">
                                <Checkbox id="remember" name="remember" tabIndex={3} />
                                <Label htmlFor="remember" className="text-sm font-normal">
                                    Keep me signed in
                                </Label>
                            </div>

                            <Button
                                type="submit"
                                className="h-11 w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                                tabIndex={4}
                                disabled={processing}
                            >
                                {processing && <Spinner />}
                                Access admin panel
                            </Button>
                        </div>

                        <div className="relative">
                            <Separator />
                            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                                Need access?
                            </span>
                        </div>

                        <Button variant="outline" className="h-11 w-full" asChild tabIndex={6}>
                            <TextLink href={register({})}>Request admin account</TextLink>
                        </Button>
                    </>
                )}
            </Form>

            {status && (
                <p className="mt-2 text-center text-sm font-medium text-green-600">{status}</p>
            )}
        </>
    );
}

LoginCard.layout = {
    title: 'Admin sign in',
    description: 'Restricted to authorized administrators only',
    variant: 'card' as const,
};
