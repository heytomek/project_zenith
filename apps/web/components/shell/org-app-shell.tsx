"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Factory,
  HardHat,
  LayoutDashboard,
  Settings2,
  Sparkles,
  Waypoints,
  Wrench,
} from "lucide-react";

import { apiRequest } from "@/lib/api/client";
import type { Organization } from "@/lib/api/types";

type OrgAppShellProps = {
  children: ReactNode;
  organizationId: string;
};

type NavItem = {
  href?: string;
  label: string;
  description?: string;
  icon: LucideIcon;
};

const planLoopLinks = [
  { href: "overview", label: "Today", step: "00" },
  { href: "planning/run", label: "Run", step: "01" },
  { href: "planning/results", label: "Review", step: "02" },
  { href: "planning/reports", label: "Actuals", step: "03" },
];

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Plan",
    items: [
      {
        href: "overview",
        label: "Today",
        description: "Next step",
        icon: LayoutDashboard,
      },
      {
        href: "planning/run",
        label: "Run",
        description: "Make draft",
        icon: Sparkles,
      },
      {
        href: "planning/results",
        label: "Review",
        description: "Fix draft",
        icon: Waypoints,
      },
      {
        href: "planning/reports",
        label: "Actuals",
        description: "Compare field",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Inputs",
    items: [
      {
        href: "demand/work-orders",
        label: "Work",
        description: "Demand",
        icon: ClipboardList,
      },
      {
        href: "workforce/workers",
        label: "People",
        description: "Capacity",
        icon: HardHat,
      },
      {
        href: "workforce/catalog",
        label: "Capabilities",
        description: "Skills",
        icon: BadgeCheck,
      },
      {
        href: "demand/policies",
        label: "Rules",
        description: "Targets",
        icon: BriefcaseBusiness,
      },
      {
        href: "resources/materials",
        label: "Materials",
        description: "Stock",
        icon: Factory,
      },
      {
        href: "resources/equipment",
        label: "Equipment",
        description: "Machines",
        icon: Wrench,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        href: "settings/organization",
        label: "Structure",
        description: "Sites",
        icon: Settings2,
      },
    ],
  },
];

export function OrgAppShell({ children, organizationId }: OrgAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function loadShellData() {
      try {
        const [organizationsResponse, currentOrganizationResponse] = await Promise.all([
          apiRequest<Organization[]>("/organizations"),
          apiRequest<Organization>(`/organizations/${organizationId}`),
        ]);
        if (cancelled) {
          return;
        }
        setOrganizations(organizationsResponse);
        setCurrentOrganization(currentOrganizationResponse);
      } catch {
        if (cancelled) {
          return;
        }
        setOrganizations([]);
        setCurrentOrganization(null);
      }
    }

    void loadShellData();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const activeOrganization =
    organizations.find((organization) => organization.id === organizationId)
    ?? currentOrganization;
  const switcherOrganizations =
    activeOrganization && !organizations.some((organization) => organization.id === activeOrganization.id)
      ? [activeOrganization, ...organizations]
      : organizations;

  return (
    <div className={`app-shell ${collapsed ? "app-shell--collapsed" : ""}`}>
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <div className="app-sidebar__brand-copy">
            <div className="app-sidebar__brand-icon" aria-hidden="true">
              <Building2 size={18} />
            </div>
            <p className="eyebrow">Zenith</p>
            <h2>Plan Console</h2>
          </div>
          <button
            className="ghost-button sidebar-toggle"
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            <span>{collapsed ? "Expand" : "Collapse"}</span>
          </button>
        </div>

        <div className="app-sidebar__org">
          {!collapsed ? (
            <label className="field-label" htmlFor="organization-switcher">
              Organization
            </label>
          ) : null}
          <select
            id="organization-switcher"
            className="form-select"
            value={organizationId}
            disabled={loading || switcherOrganizations.length === 0}
            onChange={(event) => {
              const nextOrganizationId = event.target.value;
              startTransition(() => {
                router.push(`/orgs/${nextOrganizationId}/overview`);
              });
            }}
          >
            {switcherOrganizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          {!collapsed && activeOrganization ? (
            <p className="sidebar-meta">
              {activeOrganization.slug} · {activeOrganization.organization_type}
            </p>
          ) : null}
        </div>

        <nav className="app-sidebar__nav" aria-label="Primary">
          {navGroups.map((group) => (
            <div key={group.label} className="nav-group">
              {!collapsed ? <p className="nav-group__label">{group.label}</p> : null}
              <div className="nav-group__items">
                {group.items.map((item) => {
                  const href = `/orgs/${organizationId}/${item.href}`;
                  const active = pathname === href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={href}
                      className={`nav-link ${active ? "nav-link--active" : ""}`}
                      title={item.label}
                    >
                      <span className="nav-link__icon" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      {!collapsed ? (
                        <span className="nav-link__copy">
                          <span>{item.label}</span>
                          {item.description ? <small>{item.description}</small> : null}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <div className="app-topbar">
          <div className="app-topbar__context">
            <p className="eyebrow">Organization</p>
            <h2 className="app-topbar__title">
              {activeOrganization?.name ?? "Loading organization"}
            </h2>
            {activeOrganization ? (
              <p className="app-topbar__meta">
                {activeOrganization.slug} / {activeOrganization.organization_type}
              </p>
            ) : null}
          </div>
          <nav className="plan-loop" aria-label="Plan flow">
            {planLoopLinks.map((link) => {
              const href = `/orgs/${organizationId}/${link.href}`;
              const active = pathname === href;
              return (
                <Link
                  key={link.href}
                  className={`plan-loop__item${active ? " plan-loop__item--active" : ""}`}
                  href={href}
                >
                  <span>{link.step}</span>
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="app-topbar__actions">
            <Link className="ghost-link" href="/">
              <ArrowLeftRight size={16} />
              Change org
            </Link>
            <a className="ghost-link" href="/api/v1/health">
              <Activity size={16} />
              API health
            </a>
          </div>
        </div>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
