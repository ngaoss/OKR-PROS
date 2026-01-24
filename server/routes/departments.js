import express from 'express';
import Department from '../models/Department.js';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Update department heads based on managers in that department
// This must come BEFORE the /:id route to be matched correctly
router.post('/:id/sync-heads', authMiddleware, async (req, res) => {
  try {
    const dep = await Department.findById(req.params.id);
    if (!dep) return res.status(404).json({ message: 'Department not found' });
    
    // Find all managers in this department
    const managers = await User.find({ 
      department: dep.name, 
      role: 'MANAGER' 
    });
    
    // Update heads with manager IDs
    dep.heads = managers.map(m => m._id.toString());
    await dep.save();
    
    res.json(dep);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// List departments (protected)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const depts = await Department.find().sort({ name: 1 });
    res.json(depts);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create department (admin only)
router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: 'Missing department name' });
  try {
    const existing = await Department.findOne({ name });
    if (existing) return res.status(400).json({ message: 'Department already exists' });
    const dep = await Department.create({ 
      name, 
      heads: [], // Always start with empty heads
      description, 
      createdBy: req.user.email 
    });
    res.json(dep);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get single department
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const dep = await Department.findById(req.params.id);
    if (!dep) return res.status(404).json({ message: 'Not found' });
    res.json(dep);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update department (admin only)
router.put('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
  const { name, description } = req.body;
  try {
    const dep = await Department.findByIdAndUpdate(
      req.params.id, 
      { name, description }, 
      { new: true }
    );
    if (!dep) return res.status(404).json({ message: 'Not found' });
    res.json(dep);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete department (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
  try {
    const dep = await Department.findByIdAndDelete(req.params.id);
    if (!dep) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
