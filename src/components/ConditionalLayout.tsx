'use client';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import GlobalFilterBar from './GlobalFilterBar';

// Routes where the sidebar + layout-container should NOT appear
const NO_SIDEBAR_ROUTES = ['/login', '/coming-soon'];

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = NO_SIDEBAR_ROUTES.some(r => pathname?.startsWith(r));

  if (hideSidebar) {
    // Render children directly — login/coming-soon handle their own full-screen layout
    return <>{children}</>;
  }

  return (
    <div className="layout-container">
      <Sidebar />
      <div className="content-wrapper">
        <GlobalFilterBar />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
