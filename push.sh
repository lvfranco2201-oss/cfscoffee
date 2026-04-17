git add -A
git commit -m "feat: Control dashboard + Global filter bar refactor

- Add Control PnL dashboard (/control) with per-store matrix
- Add /api/control route using vw_StoreCompleteSummary data
- Add /api/stores lightweight cached endpoint for store catalog
- Refactor filter system: GlobalFilterBar in ConditionalLayout
  rendered once above all pages as sticky top bar
- FilterContext loads availableStores once at app boot
- Remove per-page TopFilters from DashboardUI, PresupuestoUI, ControlUI
  all pages react to filter changes via useEffect([filter]) only
- Fix layout CSS: add .content-wrapper class with correct margin-left
  for fixed sidebar offset, mobile resets margin-left to 0
- Add Control PnL to Sidebar navigation
- Update .gitignore to exclude root-level test_*.ts scratch files"
git push origin main
