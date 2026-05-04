import { useState, useEffect } from 'react';
import AdminLayout from '../components/admin/AdminLayout';
import { Search, Plus, Edit2, Trash2, ShieldAlert } from 'lucide-react';
import './ResidentManager.css';

export default function ResidentManager() {
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone_number: '', zone_location: 'Zone A' });

  const ZONES = ['Zone A', 'Zone B', 'Main Campus', 'Hostel Block 1', 'Hostel Block 2'];

  const token = localStorage.getItem('pyrochain_token');

  useEffect(() => {
    fetchResidents();
  }, []);

  const fetchResidents = async () => {
    try {
      const res = await fetch('/api/residents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setResidents(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch residents', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/residents/${editingId}` : '/api/residents';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchResidents();
      } else {
        alert(data.message || 'Error saving resident');
      }
    } catch (err) {
      console.error('Error saving', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this resident? They will no longer receive emergency alerts.')) return;
    
    try {
      const res = await fetch(`/api/residents/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setResidents(residents.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error('Error deleting', err);
    }
  };

  const openModal = (resident = null) => {
    if (resident) {
      setEditingId(resident.id);
      setFormData({ name: resident.name, phone_number: resident.phone_number, zone_location: resident.zone_location });
    } else {
      setEditingId(null);
      setFormData({ name: '', phone_number: '', zone_location: 'Zone A' });
    }
    setShowModal(true);
  };

  const filteredResidents = residents.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.zone_location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Resident Contact Manager">
      <div className="rm-container">
        
        <div className="alert-table-card">
          <div className="rm-header">
            <div className="rm-info">
              <div>
                <h3>Emergency SMS Registry</h3>
                <p>Manage phone numbers for automatic evacuation alerts. Note: Residents can reply <strong>STOP</strong> to any alert to automatically opt out via Twilio.</p>
              </div>
            </div>
            <button className="rm-btn-add" onClick={() => openModal()}>
              <Plus size={16} /> Add Resident
            </button>
          </div>

          <div className="rm-controls">
            <div className="rm-search">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search by name or zone..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="rm-table-wrapper">
            {loading ? (
              <div className="rm-loading">Loading residents...</div>
            ) : (
              <table className="rm-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone Number</th>
                    <th>Assigned Zone</th>
                    <th>Date Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResidents.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="rm-empty">No residents found. Add someone to receive alerts!</td>
                    </tr>
                  ) : (
                    filteredResidents.map(resident => (
                      <tr key={resident.id}>
                        <td><div className="rm-name">{resident.name}</div></td>
                        <td><div className="rm-phone">{resident.phone_number}</div></td>
                        <td>
                          <span className="rm-zone-badge">{resident.zone_location}</span>
                        </td>
                        <td><span className="rm-date">{new Date(resident.created_at).toLocaleDateString()}</span></td>
                        <td>
                          <div className="rm-actions">
                            <button className="rm-btn-icon" onClick={() => openModal(resident)} title="Edit">
                              <Edit2 size={14} />
                            </button>
                            <button className="rm-btn-icon rm-btn-delete" onClick={() => handleDelete(resident.id)} title="Remove">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="rm-modal-overlay">
            <div className="rm-modal">
              <div className="rm-modal-header">
                <h3>{editingId ? 'Edit Resident Contact' : 'Add New Resident'}</h3>
                <button className="rm-close-btn" onClick={() => setShowModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleSubmit} className="rm-form">
                <div className="rm-form-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., John Doe"
                  />
                </div>
                <div className="rm-form-group">
                  <label>Phone Number (with country code)</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.phone_number}
                    onChange={e => setFormData({...formData, phone_number: e.target.value})}
                    placeholder="e.g., +12345678900"
                  />
                </div>
                <div className="rm-form-group">
                  <label>Zone / Location</label>
                  <select 
                    value={formData.zone_location}
                    onChange={e => setFormData({...formData, zone_location: e.target.value})}
                  >
                    {ZONES.map(zone => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                  <small>They will only receive alerts if a fire is detected in this zone.</small>
                </div>
                <div className="rm-modal-footer">
                  <button type="button" className="rm-btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="rm-btn-save">Save Contact</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
