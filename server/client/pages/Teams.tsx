
import React, { useEffect, useState } from 'react';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../services/departmentService';
import { userService } from '../services/userService';
import { getOKRs } from '../services/okrService';
import { taskService } from '../services/taskService';
import { useAuth } from '../context/AuthContext';

export const Teams: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [departments, setDepartments] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', head: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  async function fetchDepartments() {
    try {
      const [depts, users, okrs, tasks] = await Promise.all([
        getDepartments(),
        userService.getUsers(),
        getOKRs(),
        taskService.getTasks()
      ]);
      const adapted = depts.map((d: any) => {
        const deptUsers = users.filter((u: any) => u.department === d.name);
        const deptOkrs = okrs.filter((o: any) => o.department === d.name);
        const deptTasks = tasks.filter((t: any) => deptUsers.some((u: any) => u.id === t.assigneeId));
        const deptTasksDone = deptTasks.filter((t: any) => t.status === 'DONE').length;
        const progress = deptTasks.length > 0 ? Math.round((deptTasksDone / deptTasks.length) * 100) : 0;
        return {
          name: d.name,
          head: d.head || '—',
          members: deptUsers.length,
          tasks: deptTasks.length,
          status: 'Active',
          progress: progress,
          color: 'text-blue-600',
          id: d._id
        };
      });
      setDepartments(adapted);
    } catch (err: any) {
      console.error('Failed to load departments', err);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return alert('Vui lòng nhập tên phòng ban');
    setIsSubmitting(true);
    try {
      if (editingDeptId) {
        const dep = await updateDepartment(editingDeptId, form);
        const adapted = {
          name: dep.name,
          head: dep.head || '—',
          members: 0,
          tasks: 0,
          status: 'Active',
          progress: 0,
          color: 'text-blue-600',
          id: dep._id
        };
        setDepartments(prev => prev.map(p => p.id === adapted.id ? adapted : p));
        setStatusMessage('Cập nhật phòng ban thành công');
      } else {
        const dep = await createDepartment(form);
        const adapted = {
          name: dep.name,
          head: dep.head || '—',
          members: 0,
          tasks: 0,
          status: 'Active',
          progress: 0,
          color: 'text-blue-600',
          id: dep._id
        };
        setDepartments(prev => [adapted, ...prev]);
        setStatusMessage('Tạo phòng ban thành công');
      }
      setTimeout(() => setStatusMessage(''), 3000);
      setShowModal(false);
      setForm({ name: '', head: '', description: '' });
      setEditingDeptId(null);
      fetchDepartments(); // Refetch to update counts
    } catch (err: any) {
      alert(err?.message || 'Không thể lưu phòng ban');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (dept: any) => {
    setEditingDeptId(dept.id);
    setForm({ name: dept.name, head: dept.head === '—' ? '' : dept.head, description: dept.description || '' });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa phòng ban này?')) return;
    setDeletingId(id);
    try {
      await deleteDepartment(id);
      setDepartments(prev => prev.filter(d => d.id !== id));
      setStatusMessage('Xóa phòng ban thành công');
      setTimeout(() => setStatusMessage(''), 3000);
      fetchDepartments(); // Refetch to update counts
    } catch (err: any) {
      alert(err?.message || 'Không thể xóa phòng ban');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Cơ cấu Phòng ban</h2>
          <p className="text-slate-500 text-sm">Quản lý các đơn vị và hiệu suất làm việc của từng team.</p>
        </div>
        {currentUser?.role === 'ADMIN' ? (
          <button onClick={() => { setEditingDeptId(null); setForm({ name: '', head: '', description: '' }); setShowModal(true); }} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-all flex items-center space-x-2">
            <span className="material-icons text-lg">add</span>
            <span>Thêm phòng ban</span>
          </button>
        ) : (
          <button disabled className="bg-white border border-slate-100 text-slate-400 px-4 py-2 rounded-lg font-medium flex items-center space-x-2">Thêm phòng ban</button>
        )}
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-700 rounded-md">{statusMessage}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {currentUser?.role === 'ADMIN' && (
          <div onClick={() => { setEditingDeptId(null); setForm({ name: '', head: '', description: '' }); setShowModal(true); }} className="cursor-pointer bg-white rounded-2xl border-dashed border-2 border-slate-200 hover:border-indigo-300 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-2">
                <span className="material-icons text-blue-600">add</span>
              </div>
              <p className="font-bold text-slate-800">Thêm phòng ban</p>
              <p className="text-xs text-slate-400">Tạo phòng ban mới</p>
            </div>
          </div>
        )}

        {departments.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center text-slate-500">Chưa có phòng ban nào. Hãy tạo phòng ban mới.</div>
        )}

        {departments.map((dept, i) => (
          <div key={dept.id || i} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center ${dept.color}`}>
                    <span className="material-icons text-3xl">corporate_fare</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">{dept.name}</h3>
                    <p className="text-sm text-slate-500 font-medium">Trưởng phòng: {dept.head}</p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded uppercase tracking-widest border border-emerald-100">
                  {dept.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Nhân sự</p>
                  <div className="flex items-center space-x-2">
                    <span className="material-icons text-slate-400 text-base">person</span>
                    <span className="text-lg font-bold text-slate-800">{dept.members} thành viên</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Dự án</p>
                  <div className="flex items-center space-x-2">
                    <span className="material-icons text-slate-400 text-base">rocket</span>
                    <span className="text-lg font-bold text-slate-800">{dept.tasks} nhiệm vụ</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tiến độ công việc</p>
                  <span className={`text-sm font-bold ${dept.color}`}>{dept.progress}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${dept.color.replace('text', 'bg')}`} 
                    style={{ width: `${dept.progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-t border-slate-100">
              <div className="flex -space-x-2">
                {[1,2,3,4].map(n => (
                  <img key={n} src={`https://picsum.photos/seed/user${n}${dept.name}/100/100`} className="w-8 h-8 rounded-full border-2 border-white" alt="avatar" />
                ))}
                <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                  +{dept.members - 4}
                </div>
              </div>
              {currentUser?.role === 'ADMIN' ? (
                <div className="flex items-center space-x-2">
                  <button onClick={() => handleEdit(dept)} className="text-blue-600 text-sm font-bold hover:underline">Sửa</button>
                  <button onClick={() => handleDelete(dept.id)} disabled={deletingId === dept.id} className="text-rose-600 text-sm font-bold hover:underline">{deletingId === dept.id ? 'Đang xóa…' : 'Xóa'}</button>
                </div>
              ) : (
                <button className="text-blue-600 text-sm font-bold hover:underline">Xem chi tiết</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold">{editingDeptId ? 'Chỉnh sửa phòng ban' : 'Tạo phòng ban mới'}</h3>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên phòng ban</label>
              <input 
                type="text" 
                required
                placeholder="Kỹ thuật"
                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trưởng phòng (tùy chọn)</label>
              <input 
                type="text" 
                placeholder="Nguyễn Văn A"
                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.head}
                onChange={e => setForm({...form, head: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mô tả</label>
              <textarea 
                rows={3}
                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
              />
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-slate-500">{statusMessage}</div>
              <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 font-bold text-sm">Hủy</button>
                <button type="submit" disabled={isSubmitting} className={`px-6 py-2 rounded-lg font-bold text-sm shadow-lg shadow-indigo-100 ${isSubmitting ? 'bg-slate-300 text-slate-700' : 'bg-blue-600 text-white'}`}>
                  {isSubmitting ? (editingDeptId ? 'Đang lưu…' : 'Đang tạo…') : (editingDeptId ? 'Lưu thay đổi' : 'Tạo phòng ban')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
