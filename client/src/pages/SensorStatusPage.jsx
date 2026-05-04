import { useAdmin } from '../context/AdminContext';
import AdminLayout from '../components/admin/AdminLayout';
import { ZoneList } from '../components/admin/SideWidgets';

export default function SensorStatusPage() {
  const { zoneList } = useAdmin();

  return (
    <AdminLayout title="Hardware Cluster Status">
      <div style={{ maxWidth: '800px' }}>
        <ZoneList zones={zoneList} />
      </div>
    </AdminLayout>
  );
}
