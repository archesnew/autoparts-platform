import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { StaffSessionProvider } from "@/components/admin/staff-session-provider";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { getStaffContext, staffHasPermission } from "@/lib/server/staff-session";

function LogisticsWorkspace({ name }: { name: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#17191b] p-6 text-[#f5f5f5]"><section className="w-full max-w-xl border border-[#383e41] bg-[#202325] p-6 sm:p-8"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff6428]">ZAPTUT.PRO · Логистика</p><h1 className="mt-3 text-2xl font-extrabold uppercase">Добро пожаловать, {name}</h1><p className="mt-3 text-sm leading-6 text-[#aeb5b6]">Рабочее пространство логистики ещё не подключено. CRM-заявки, клиентские контакты и закупочные данные этому аккаунту не выдаются.</p><div className="mt-6"><SignOutButton/></div></section></main>;
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await getStaffContext();
  if (!staff) redirect("/login");

  if (staffHasPermission(staff, "logistics.access") && !staffHasPermission(staff, "admin.access")) {
    return <StaffSessionProvider value={staff}><LogisticsWorkspace name={staff.name}/></StaffSessionProvider>;
  }
  if (!staffHasPermission(staff, "admin.access")) redirect("/login?error=access");

  return <StaffSessionProvider value={staff}>{children}</StaffSessionProvider>;
}
