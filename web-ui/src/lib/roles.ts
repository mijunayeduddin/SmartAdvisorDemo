import { BarChart3, CalendarRange, ClipboardList, Gauge, Inbox, LayoutGrid, Library, type LucideIcon } from 'lucide-react';
import type { Role } from './types';

export const ROLE_HOME: Record<Role, string> = {
  student: '/student',
  faculty: '/faculty',
  admin: '/admin',
};

export const ROLE_LABEL: Record<Role, string> = { student: 'Student', faculty: 'Faculty', admin: 'IT admin' };

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: Record<Role, NavItem[]> = {
  student: [
    { href: '/student', label: 'Overview', icon: LayoutGrid },
    { href: '/student/courses', label: 'Courses', icon: Library },
    { href: '/student/schedule', label: 'Schedule', icon: CalendarRange },
    { href: '/student/requests', label: 'My requests', icon: ClipboardList },
  ],
  faculty: [
    { href: '/faculty', label: 'Exception queue', icon: Inbox },
    { href: '/faculty/sections', label: 'My sections', icon: BarChart3 },
  ],
  admin: [{ href: '/admin', label: 'Health & alerts', icon: Gauge }],
};
