import { useAdmin } from '../context/AdminContext';
import AdminLayout from '../components/admin/AdminLayout';
import { TempChart, SmokeChart, SeverityPieChart } from '../components/admin/Charts';

export default function AnalyticsPage() {
  const { labelHistory, tempHistory, smokeHistory, severityCounts } = useAdmin();

  return (
    <AdminLayout title="Advanced Data Analytics">
      <div className="charts-row">
        <TempChart  labels={labelHistory} data={tempHistory}  />
        <SmokeChart labels={labelHistory} data={smokeHistory} />
      </div>
      <div style={{ maxWidth: '500px', marginTop: '24px' }}>
        <SeverityPieChart counts={severityCounts} />
      </div>
    </AdminLayout>
  );
}
