import AuthCardLayout from '@/layouts/auth/auth-card-layout';
import AuthSimpleLayout from '@/layouts/auth/auth-simple-layout';

export default function AuthLayout({
    title = '',
    description = '',
    variant,
    children,
}: {
    title?: string;
    description?: string;
    variant?: 'simple' | 'card';
    children: React.ReactNode;
}) {
    if (variant === 'card') {
        return (
            <AuthCardLayout title={title} description={description}>
                {children}
            </AuthCardLayout>
        );
    }

    return (
        <AuthSimpleLayout title={title} description={description}>
            {children}
        </AuthSimpleLayout>
    );
}
