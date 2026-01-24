
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Task, Objective } from '../types';
import { dataService } from '../services/dataService';
import * as myOkrService from '../services/myOkrService';

export const Tasks: React.FC = () => {
  const { user, allUsers, selectedPeriod } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [okrs, setOkrs] = useState<Objective[]>([]);
  const [myOkrs, setMyOkrs] = useState<Objective[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', description: '', assigneeId: '', krId: '', dueDate: '', priority: 'MEDIUM' });

  const getKrTitle = (krId: string) => {
    if (!krId) return 'N/A';
    
    // Tìm trong OKRs
    for (const o of okrs) {
      if (o.keyResults) {
        for (const kr of o.keyResults) {
          if (kr.id === krId || kr._id === krId) {
            return kr.title;
          }
        }
      }
    }
    
    // Tìm trong myOKRs
    for (const o of myOkrs) {
      if (o.keyResults) {
        for (const kr of o.keyResults) {
          if (kr.id === krId || kr._id === krId) {
            return kr.title;
          }
        }
      }
    }
    
    return 'N/A';
  };

  const loadData = async () => {
    setIsLoading(true);
    const t = await dataService.getTasks();
    const o = await dataService.getOKRs();
    
    // Lấy myOKRs với period
    let m: Objective[] = [];
    try {
      const myOKRsData = await myOkrService.getMyOKRs({ 
        quarter: selectedPeriod.quarter, 
        year: selectedPeriod.year 
      });
      m = (myOKRsData || []).map((okr: any) => ({
        ...okr,
        id: okr._id || okr.id,
        keyResults: (okr.keyResults || []).map((kr: any) => ({ ...kr, id: kr._id || kr.id }))
      }));
    } catch (err) {
      // Fallback - không hiển thị lỗi nếu không lấy được myOKRs
    }
    
    // Filter tasks: EMPLOYEE chỉ xem task của bản thân, MANAGER xem task của phòng ban
    let filteredTasks = t;
    if (user?.role === 'EMPLOYEE') {
      const userId = user?.id || user?._id;
      filteredTasks = t.filter((task: Task) => task.assigneeId === userId);
    } else if (user?.role === 'MANAGER') {
      const deptName = user?.department;
      const deptUsers = allUsers.filter((u: any) => u.department === deptName);
      const deptUserIds = deptUsers.map((u: any) => u.id || u._id);
      filteredTasks = t.filter((task: Task) => deptUserIds.includes(task.assigneeId));
    }
    
    setTasks(filteredTasks);
    setOkrs(o);
    setMyOkrs(m);
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, [selectedPeriod]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const assignee = allUsers.find(u => u.id === formData.assigneeId);
    const krTitle = getKrTitle(formData.krId);

    const payload = { ...formData, assigneeName: assignee?.name || 'Vô danh', krTitle };

    if (editingTask) {
      await dataService.updateTask(editingTask.id, payload);
    } else {
      await dataService.saveTask(payload);
    }
    await loadData();
    setShowModal(false);
    setEditingTask(null);
    setFormData({ title: '', description: '', assigneeId: '', krId: '', dueDate: '', priority: 'MEDIUM' });
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      assigneeId: task.assigneeId,
      krId: task.krId,
      dueDate: task.dueDate || '',
      priority: task.priority
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa công việc này?')) return;
    setDeletingId(id);
    try {
      await dataService.deleteTask(id);
      await loadData();
      window.dispatchEvent(new CustomEvent('okrUpdated'));
    } catch (err: any) {
      alert(err?.message || 'Không thể xóa công việc');
    } finally {
      setDeletingId(null);
    }
  };

  const updateStatus = async (id: string, status: any) => {
    await dataService.updateTaskStatus(id, status);
    await loadData();
    window.dispatchEvent(new CustomEvent('okrUpdated'));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Hạng mục công việc</h2>
        <button onClick={() => { setEditingTask(null); setFormData({ title: '', description: '', assigneeId: '', krId: '', dueDate: '', priority: 'MEDIUM' }); setShowModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center space-x-2">
          <span className="material-icons">add_task</span>
          <span>Giao việc mới</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tasks.length === 0 && (
          <div className="col-span-full p-12 text-center text-slate-400 bg-white border border-dashed rounded-2xl">
            Chưa có công việc nào được giao.
          </div>
        )}
        {tasks.map(task => (
          <div key={task.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col group hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-slate-800 line-clamp-1">{task.title}</h4>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                task.priority === 'HIGH' ? 'bg-red-50 text-red-600' :
                task.priority === 'MEDIUM' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'
              }`}>
                {task.priority}
              </span>
            </div>
            <p className="text-xs text-slate-500 line-clamp-2 mb-4 flex-1">{task.description}</p>
            <div className="bg-slate-50 p-2 rounded-lg mb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Key Result</p>
              <p className="text-[11px] font-medium text-slate-700 truncate">{getKrTitle(task.krId)}</p>
            </div>
            <div className="pt-4 border-t flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span className="material-icons text-slate-400 text-sm">person</span>
                <span className="text-xs font-bold text-slate-700">{task.assigneeName}</span>
              </div>
              <div className="flex items-center space-x-3">
                <button onClick={() => handleEdit(task)} className="text-indigo-600 text-sm font-bold hover:underline">Sửa</button>
                <button onClick={() => handleDelete(task.id)} disabled={deletingId === task.id} className="text-rose-600 text-sm font-bold hover:underline">{deletingId === task.id ? 'Đang xóa…' : 'Xóa'}</button>
                <select 
                  value={task.status} 
                  onChange={e => updateStatus(task.id, e.target.value as any)} 
                  className={`text-[10px] font-bold border rounded-lg px-2 py-1 outline-none ${
                    task.status === 'DONE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    task.status === 'IN_PROGRESS' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <option value="TODO">TO DO</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="DONE">DONE</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-lg p-8 space-y-5 animate-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-800">{editingTask ? 'Chỉnh sửa công việc' : 'Giao việc mới'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tiêu đề công việc</label>
                <input required placeholder="Nhập tiêu đề..." className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mô tả chi tiết</label>
                <textarea placeholder="Mô tả công việc cần làm..." className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-24" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Người thực hiện</label>
                  <select required className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.assigneeId} onChange={e => setFormData({...formData, assigneeId: e.target.value})}>
                    <option value="">-- Chọn --</option>
                    {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Độ ưu tiên</label>
                  <select required className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                    <option value="LOW">Thấp</option>
                    <option value="MEDIUM">Trung bình</option>
                    <option value="HIGH">Cao</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Liên kết Key Result</label>
                <select required className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.krId} onChange={e => setFormData({...formData, krId: e.target.value})}>
                  <option value="">-- Mục tiêu OKR --</option>
                  {okrs.map(o => o.keyResults && o.keyResults.map(kr => (
                    <option key={kr.id || kr._id} value={kr.id || kr._id}>{o.title}: {kr.title}</option>
                  )))}
                  {myOkrs.length > 0 && (
                    <>
                      <optgroup label="---OKRs cá nhân---">
                        {myOkrs.map(o => o.keyResults && o.keyResults.map(kr => (
                          <option key={kr.id || kr._id} value={kr.id || kr._id}>{o.title}: {kr.title}</option>
                        )))}
                      </optgroup>
                    </>
                  )}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button type="button" onClick={() => { setShowModal(false); setEditingTask(null); setFormData({ title: '', description: '', assigneeId: '', krId: '', dueDate: '', priority: 'MEDIUM' }); }} className="px-6 py-2 text-slate-500 font-bold">Hủy</button>
              <button type="submit" className="bg-indigo-600 text-white px-8 py-2 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">{editingTask ? 'Lưu thay đổi' : 'Giao việc'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
