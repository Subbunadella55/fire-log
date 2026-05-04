const supabase = require('../config/supabase');

// Get all residents
const getResidents = async (req, res) => {
    try {
        if (!supabase) return res.status(500).json({ success: false, message: 'Supabase not configured' });
        
        const { data, error } = await supabase.from('residents').select('*').order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({ success: true, data });
    } catch (err) {
        console.error('[Resident] Error fetching:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Add new resident
const addResident = async (req, res) => {
    try {
        if (!supabase) return res.status(500).json({ success: false, message: 'Supabase not configured' });
        
        const { name, phone_number, zone_location } = req.body;
        
        if (!name || !phone_number || !zone_location) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        
        const { data, error } = await supabase.from('residents').insert([
            { name, phone_number, zone_location }
        ]).select();
        
        if (error) throw error;
        
        res.status(201).json({ success: true, data: data[0] });
    } catch (err) {
        console.error('[Resident] Error adding:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update resident
const updateResident = async (req, res) => {
    try {
        if (!supabase) return res.status(500).json({ success: false, message: 'Supabase not configured' });
        
        const { id } = req.params;
        const { name, phone_number, zone_location } = req.body;
        
        const { data, error } = await supabase.from('residents')
            .update({ name, phone_number, zone_location })
            .eq('id', id)
            .select();
            
        if (error) throw error;
        
        res.json({ success: true, data: data[0] });
    } catch (err) {
        console.error('[Resident] Error updating:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Delete resident
const deleteResident = async (req, res) => {
    try {
        if (!supabase) return res.status(500).json({ success: false, message: 'Supabase not configured' });
        
        const { id } = req.params;
        
        const { error } = await supabase.from('residents').delete().eq('id', id);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Resident deleted' });
    } catch (err) {
        console.error('[Resident] Error deleting:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    getResidents,
    addResident,
    updateResident,
    deleteResident
};
