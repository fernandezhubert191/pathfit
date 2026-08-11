import { Head, Link } from '@inertiajs/react';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { login } from '@/routes';

/**
 * Admin registration is disabled.
 * Admin accounts are created directly in the database or via seeder.
 * Students and teachers register via the mobile app.
 */
export default function Register() {
    return (
        <>
            <Head title="Registration unavailable" />

            <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                    <ShieldOff className="size-5 text-destructive" />
                </div>

                <div className="space-y-1">
                    <h2 className="text-base font-semibold">
                        Registration not available
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Admin accounts are provisioned by the system owner.
                        Students and teachers register via the{' '}
                        <span className="font-medium text-foreground">
                            mobile app
                        </span>
                        .
                    </p>
                </div>

                <Button asChild variant="outline" className="w-full">
                    <Link href={login()}>Back to sign in</Link>
                </Button>
            </div>
        </>
    );
}

Register.layout = {
    title: 'Registration unavailable',
    description: 'This portal is for administrators only',
};
