import mongoose from 'mongoose';

const DepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  heads: { type: [String], default: [] }, // array of manager user IDs
  description: { type: String },
  createdBy: { type: String },
}, { timestamps: true });

export default mongoose.model('Department', DepartmentSchema);
