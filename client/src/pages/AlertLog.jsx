import { useAdmin } from '../context/AdminContext';
import AdminLayout from '../components/admin/AdminLayout';
import AlertTable from '../components/admin/AlertTable';

export default function AlertLog() {
  const {
    pageAlerts, currentPage, totalPages, filteredAlerts,
    currentFilter, setCurrentFilter, changePage, resolveAlert
  } = useAdmin();

  return (
    <AdminLayout title="Alert Log & History">
      <AlertTable
        alerts={pageAlerts}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={filteredAlerts.length}
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        onPageChange={changePage}
        onResolve={resolveAlert}
      />
    </AdminLayout>
  );
}
