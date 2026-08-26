import { Form, Head } from '@inertiajs/react';
import { KeyRound, Mail } from 'lucide-react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import type { TeamInvitationContext } from '@/types';

type Props = {
    status?: string;
    canResetPassword: boolean;
    teamInvitation?: TeamInvitationContext | null;
};

export default function Login({ status, canResetPassword, teamInvitation }: Props) {
    return (
        <>
            <Head title="Sign in" />

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-5"
            >
                {({ processing, errors }) => (
                    <>
                        {teamInvitation && (
                            <div className="flex items-center gap-3 rounded-lg border border-white/30 bg-white/10 px-4 py-3 backdrop-blur-sm">
                                <div>
                                    <p className="text-xs font-semibold text-white drop-shadow">
                                        You're invited to{' '}
                                        <span className="font-bold">{teamInvitation.teamName}</span>
                                    </p>
                                    <p className="text-xs text-white/70">Sign in to accept your invitation</p>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-4">
                            {/* Email */}
                            <div className="grid gap-1.5">
                                <Label
                                    htmlFor="email"
                                    className="flex items-center gap-1.5 text-sm font-medium text-white/90"
                                >
                                    <Mail className="size-3.5 text-white/60" />
                                    Email address
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
                                    className="h-11 border-white/30 bg-white/15 text-white placeholder:text-white/40 backdrop-blur-sm focus:border-white/60 focus:bg-white/20"
                                />
                                <InputError message={errors.email} />
                            </div>

                            {/* Password */}
                            <div className="grid gap-1.5">
                                <div className="flex items-center justify-between">
                                    <Label
                                        htmlFor="password"
                                        className="flex items-center gap-1.5 text-sm font-medium text-white/90"
                                    >
                                        <KeyRound className="size-3.5 text-white/60" />
                                        Password
                                    </Label>
                                    {canResetPassword && (
                                        <TextLink
                                            href={request()}
                                            className="text-xs text-white/60 hover:text-white/90"
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
                                    className="h-11 border-white/30 bg-white/15 text-white placeholder:text-white/40 backdrop-blur-sm focus:border-white/60 focus:bg-white/20"
                                />
                                <InputError message={errors.password} />
                            </div>

                            {/* Remember me */}
                            <div className="flex items-center gap-2.5">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    tabIndex={3}
                                    className="border-white/40 data-[state=checked]:bg-white data-[state=checked]:text-gray-900"
                                />
                                <Label
                                    htmlFor="remember"
                                    className="text-sm font-normal text-white/80"
                                >
                                    Keep me signed in
                                </Label>
                            </div>

                            <Button
                                type="submit"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                                className="h-11 w-full bg-white/90 text-sm font-semibold text-gray-900 hover:bg-white"
                            >
                                {processing && <Spinner />}
                                Sign in
                            </Button>
                        </div>
                    </>
                )}
            </Form>

            {status && (
                <p className="mt-3 text-center text-sm font-medium text-green-300 drop-shadow">
                    {status}
                </p>
            )}
        </>
    );
}

Login.layout = {
    title: 'Pathfit',
    description: 'Sign in to your admin account',
};
