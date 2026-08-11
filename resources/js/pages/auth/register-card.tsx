import { Form, Head } from '@inertiajs/react';
import { KeyRound, Mail, ShieldCheck, User } from 'lucide-react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/routes';
import { store } from '@/routes/register';

type Props = {
    passwordRules: string;
};

export default function RegisterCard({ passwordRules }: Props) {
    return (
        <>
            <Head title="Admin Registration" />

            <Form
                {...store.form()}
                resetOnSuccess={['password', 'password_confirmation']}
                disableWhileProcessing
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
                                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Administrator Registration</p>
                                <p className="text-xs text-muted-foreground">Create a new admin account</p>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            {/* Name */}
                            <div className="grid gap-1.5">
                                <Label htmlFor="name" className="flex items-center gap-1.5">
                                    <User className="size-3.5 text-muted-foreground" />
                                    Full name
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    name="name"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="name"
                                    placeholder="Jane Smith"
                                    className="h-11"
                                />
                                <InputError message={errors.name} />
                            </div>

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
                                    tabIndex={2}
                                    autoComplete="email"
                                    placeholder="admin@example.com"
                                    className="h-11"
                                />
                                <InputError message={errors.email} />
                            </div>

                            {/* Password */}
                            <div className="grid gap-1.5">
                                <Label htmlFor="password" className="flex items-center gap-1.5">
                                    <KeyRound className="size-3.5 text-muted-foreground" />
                                    Password
                                </Label>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={3}
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    passwordrules={passwordRules}
                                    className="h-11"
                                />
                                <InputError message={errors.password} />
                            </div>

                            {/* Confirm password */}
                            <div className="grid gap-1.5">
                                <Label htmlFor="password_confirmation">Confirm password</Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    required
                                    tabIndex={4}
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    passwordrules={passwordRules}
                                    className="h-11"
                                />
                                <InputError message={errors.password_confirmation} />
                            </div>

                            <Button
                                type="submit"
                                className="h-11 w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                                tabIndex={5}
                                disabled={processing}
                            >
                                {processing && <Spinner />}
                                Create admin account
                            </Button>
                        </div>

                        <div className="relative">
                            <Separator />
                            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                                Already registered?
                            </span>
                        </div>

                        <Button variant="outline" className="h-11 w-full" asChild tabIndex={6}>
                            <TextLink href={login()}>Sign in to admin panel</TextLink>
                        </Button>
                    </>
                )}
            </Form>
        </>
    );
}

RegisterCard.layout = {
    title: 'Create admin account',
    description: 'Register to access the administrator panel',
    variant: 'card' as const,
};
