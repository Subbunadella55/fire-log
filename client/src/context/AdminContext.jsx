import { createContext, useContext, useState } from 'react';
import { useAdminDashboard } from '../hooks/useAdminDashboard';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [search, setSearch] = useState('');
  const data = useAdminDashboard(search);
  
  // Combine custom state with hook data
  const value = {
    ...data,
    search,
    setSearch
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error('useAdmin must be used within AdminProvider');
  return context;
}
