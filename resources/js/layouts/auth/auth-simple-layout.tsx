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
        <>
            <style>{`
                @keyframes bgPan {
                    0%   { background-position: center 35%; }
                    50%  { background-position: center 55%; }
                    100% { background-position: center 35%; }
                }
                .bg-pan {
                    animation: bgPan 10s ease-in-out infinite;
                }
            `}</style>
            <div
                className="bg-pan relative flex min-h-screen items-center justify-center px-4"
                style={{ backgroundImage: "url('/background.png')", backgroundSize: 'cover' }}
            >
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative z-10 w-full max-w-sm">

                    {/* Card with logo + form inside */}
                    <div className="rounded-2xl border border-white/30 bg-white/20 p-8 shadow-xl backdrop-blur-md">

                        {/* Logo + title inside the card */}
                        <div className="mb-8 flex flex-col items-center gap-3">
                            <Link href={home()}>
                                <img
                                    src="/logo.png"
                                    alt="PATHFIT Logo"
                                    className="h-24 w-auto object-contain"
                                />
                            </Link>
                            <div className="text-center">
                                <h1 className="text-2xl font-bold text-white drop-shadow">{title}</h1>
                                {description && (
                                    <p className="mt-1 text-sm text-white/80">{description}</p>
                                )}
                            </div>
                        </div>

                        {children}
                    </div>

                </div>
            </div>
        </>
    );
}
