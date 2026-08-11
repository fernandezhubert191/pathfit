import { Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-white px-4">
            <div className="w-full max-w-sm">

                {/* Logo centered at top */}
                <div className="mb-8 flex flex-col items-center gap-3">
                    <Link href={home()}>
                        <img
                            src="/logo.png"
                            alt="PATHFIT Logo"
                            className="h-24 w-auto object-contain"
                        />
                    </Link>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                        {description && (
                            <p className="mt-1 text-sm text-gray-500">{description}</p>
                        )}
                    </div>
                </div>

                {/* Form */}
                <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                    {children}
                </div>

            </div>
        </div>
    );
}
