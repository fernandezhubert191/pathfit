import { Link, usePage } from '@inertiajs/react';
import { BookCopy, LayoutDashboard, LayoutGrid } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';

export function AppSidebar() {
    const page = usePage();
    const teamSlug = (page.props.currentTeam as { slug: string } | null)?.slug ?? '';
    const dashboardUrl = teamSlug ? dashboard(teamSlug) : '/';
    const overviewUrl  = teamSlug ? `/${teamSlug}/overview` : '/';
    const modulesUrl   = teamSlug ? `/${teamSlug}/modules` : '/';

    const mainNavItems: NavItem[] = [
        {
            title: 'Overview',
            href: overviewUrl,
            icon: LayoutDashboard,
        },
        {
            title: 'User Management',
            href: dashboardUrl,
            icon: LayoutGrid,
        },
        {
            title: 'Modules',
            href: modulesUrl,
            icon: BookCopy,
        },
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={overviewUrl} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
