import { useAdmin } from '../context/AdminContext';
import AdminLayout from '../components/admin/AdminLayout';
import StatCards from '../components/admin/StatCards';
import PriorityBanner from '../components/admin/PriorityBanner';
import { TempChart, SmokeChart } from '../components/admin/Charts';
import AlertTable from '../components/admin/AlertTable';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const {
    stats, priorityZone, labelHistory, tempHistory, smokeHistory,
    pageAlerts, currentPage, totalPages, filteredAlerts,
    currentFilter, setCurrentFilter, changePage, resolveAlert
  } = useAdmin();

  return (
    <AdminLayout title="System Overview">
      {/* Priority Banner */}
      {priorityZone && <PriorityBanner zone={priorityZone} />}

      {/* Main Stats */}
      <StatCards stats={stats} />

      {/* Quick Alerts Preview */}
      <div className="section-header">
        <h2 className="section-title">Recent Alerts</h2>
      </div>
      <AlertTable
        alerts={pageAlerts.slice(0, 5)}
        currentPage={currentPage}
        totalPages={1}
        totalCount={Math.min(filteredAlerts.length, 5)}
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        onPageChange={() => {}}
        onResolve={resolveAlert}
      />

      {/* Trend Preview */}
      <div className="charts-row">
        <TempChart  labels={labelHistory} data={tempHistory}  />
        <SmokeChart labels={labelHistory} data={smokeHistory} />
      </div>
    </AdminLayout>
  );
}
