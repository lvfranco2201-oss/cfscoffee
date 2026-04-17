'use client';

import TopFilters from '@/components/TopFilters';
import { useFilter } from '@/context/FilterContext';

/**
 * GlobalFilterBar — rendered once in the layout, above every page.
 * Reads availableStores from FilterContext (loaded once at app boot).
 * No onApply prop needed: each page re-fetches via useEffect([filter]).
 */
export default function GlobalFilterBar() {
  const { availableStores } = useFilter();

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      padding: '0.6rem 1.5rem',
      borderBottom: '1px solid var(--border-color)',
      background: 'rgba(7,11,20,0.8)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 200,
      minHeight: '48px',
    }}>
      <TopFilters availableStores={availableStores} />
    </div>
  );
}
