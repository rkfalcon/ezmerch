"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/actions/auth";

interface UserWithRole {
  email?: string;
  isAdmin: boolean;
  isStoreOwner: boolean;
}

const adminLinks = [
  { href: "/dashboard/admin/stores", label: "Stores" },
  { href: "/dashboard/admin/orders", label: "Orders" },
];

const storeOwnerLinks = [
  { href: "/dashboard/store", label: "Overview" },
  { href: "/dashboard/store/products", label: "Products" },
  { href: "/dashboard/store/orders", label: "Orders" },
  { href: "/dashboard/store/settings", label: "Settings" },
  { href: "/dashboard/store/connect", label: "Stripe Connect" },
];

export function DashboardSidebar({ user }: { user: UserWithRole }) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/dashboard" className="text-lg font-bold">
          EZMerch
        </Link>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </SidebarHeader>
      <SidebarContent>
        {user.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminLinks.map((link) => (
                  <SidebarMenuItem key={link.href}>
                    <SidebarMenuButton
                      isActive={pathname === link.href}
                      render={<Link href={link.href} />}
                    >
                      {link.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {user.isStoreOwner && (
          <SidebarGroup>
            <SidebarGroupLabel>My Store</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {storeOwnerLinks.map((link) => (
                  <SidebarMenuItem key={link.href}>
                    <SidebarMenuButton
                      isActive={pathname === link.href}
                      render={<Link href={link.href} />}
                    >
                      {link.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <form action={logout}>
          <Button variant="outline" size="sm" className="w-full" type="submit">
            Sign out
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
