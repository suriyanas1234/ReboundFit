"use client";

import React from "react";
import { AppLayout } from "./AppLayout";

export { AppLayout };

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return <AppLayout>{children}</AppLayout>;
}
