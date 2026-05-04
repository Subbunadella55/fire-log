import { useAdmin } from '../context/AdminContext';
import AdminLayout from '../components/admin/AdminLayout';
import SupabaseLedger from '../components/admin/SupabaseLedger';

export default function BlockchainPage() {
  const { filteredAlerts } = useAdmin();

  return (
    <AdminLayout title="System Integrity Ledger">
      <SupabaseLedger alerts={filteredAlerts} />
    </AdminLayout>
  );
}
