
import React, { useEffect, useState } from 'react';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../services/departmentService';
import { userService } from '../services/userService';
import { getOKRs } from '../services/okrService';
import { taskService } from '../services/taskService';
import { getKPIs } from '../services/kpiService';
import { useAuth } from '../context/AuthContext';

export const Teams: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [departments, setDepartments] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [managingDeptId, setManagingDeptId] = useState<string | null>(null);
  const [managingDeptData, setManagingDeptData] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [allOkrs, setAllOkrs] = useState<any[]>([]);
  const [allKpis, setAllKpis] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      fetchDepartments();
    }
  }, [currentUser]);

  async function fetchDepartments() {
    try {
      const [depts, allUsers, okrs, tasks, kpis] = await Promise.all([
        getDepartments(),
        userService.getUsers(),
        getOKRs(),
        taskService.getTasks(),
        getKPIs()
      ]);
      setUsers(allUsers);
      setAllOkrs(okrs);
      setAllKpis(kpis);
      setAllTasks(tasks);
      
      // Filter departments based on user role
      let filteredDepts = depts;
      if (currentUser?.role === 'EMPLOYEE') {
        filteredDepts = depts.filter((d: any) => d.name === currentUser?.department);
      }
      
      const adapted = filteredDepts.map((d: any) => {
        const deptUsers = allUsers.filter((u: any) => u.department === d.name);
        const deptOkrs = okrs.filter((o: any) => o.department === d.name);
        const deptTasks = tasks.filter((t: any) => deptUsers.some((u: any) => u.id === t.assigneeId));
        const deptTasksDone = deptTasks.filter((t: any) => t.status === 'DONE').length;
        const progress = deptTasks.length > 0 ? Math.round((deptTasksDone / deptTasks.length) * 100) : 0;
        
        // Get manager names from heads array
        const headNames = d.heads && d.heads.length > 0 
          ? d.heads.map((headId: string) => {
              const headUser = allUsers.find((u: any) => u.id === headId || u._id === headId);
              return headUser?.name || 'Unknown';
            }).join(', ')
          : '—';
        
        return {
          name: d.name,
          heads: d.heads || [],
          headNames: headNames,
          members: deptUsers.length,
          tasks: deptTasks.length,
          status: 'Active',
          progress: progress,
          color: 'text-blue-600',
          id: d._id,
          description: d.description || ''
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
        const headNames = dep.heads && dep.heads.length > 0 
          ? dep.heads.map((headId: string) => {
              const headUser = users.find((u: any) => u.id === headId || u._id === headId);
              return headUser?.name || 'Unknown';
            }).join(', ')
          : '—';
        const adapted = {
          name: dep.name,
          heads: dep.heads || [],
          headNames: headNames,
          members: 0,
          tasks: 0,
          status: 'Active',
          progress: 0,
          color: 'text-blue-600',
          id: dep._id,
          description: dep.description || ''
        };
        setDepartments(prev => prev.map(p => p.id === adapted.id ? adapted : p));
        setStatusMessage('Cập nhật phòng ban thành công');
      } else {
        const dep = await createDepartment(form);
        const adapted = {
          name: dep.name,
          heads: dep.heads || [],
          headNames: '—',
          members: 0,
          tasks: 0,
          status: 'Active',
          progress: 0,
          color: 'text-blue-600',
          id: dep._id,
          description: dep.description || ''
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
    setForm({ name: dept.name, description: dept.description || '' });
    setShowModal(true);
  };

  const handleManage = (dept: any) => {
    const deptUsers = users.filter((u: any) => u.department === dept.name);
    
    // Lấy danh sách nhiệm vụ của từng thành viên trong phòng ban
    const userIds = deptUsers.map((u: any) => u.id || u._id);
    
    let deptTasks = allTasks.filter((t: any) => userIds.includes(t.assigneeId));
    let deptOkrs: any[] = [];
    let deptKpis: any[] = [];
    
    // Nếu là EMPLOYEE, chỉ xem nhiệm vụ, OKR, KPI của bản thân
    if (currentUser?.role === 'EMPLOYEE') {
      const currentUserId = currentUser?.id || currentUser?._id;
      deptTasks = allTasks.filter((t: any) => t.assigneeId === currentUserId);
      deptOkrs = allOkrs.filter((o: any) => o.assignee === currentUserId);
      deptKpis = allKpis.filter((k: any) => k.owner === currentUserId);
    } else {
      // ADMIN/MANAGER xem tất cả
      deptOkrs = allOkrs.filter((o: any) => o.department === dept.name);
      deptKpis = allKpis.filter((k: any) => k.department === dept.name);
    }
    
    // Sắp xếp thành viên: Manager trước, Employee sau
    const sortedUsers = [...deptUsers].sort((a: any, b: any) => {
      if (a.role === 'MANAGER' && b.role !== 'MANAGER') return -1;
      if (a.role !== 'MANAGER' && b.role === 'MANAGER') return 1;
      return a.name.localeCompare(b.name);
    });
    
    setManagingDeptId(dept.id);
    setManagingDeptData({
      ...dept,
      members: sortedUsers,
      tasks: deptTasks,
      okrs: deptOkrs,
      kpis: deptKpis
    });
    setShowManageModal(true);
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
          <button onClick={() => { setEditingDeptId(null); setForm({ name: '', description: '' }); setShowModal(true); }} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-all flex items-center space-x-2">
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
          <div onClick={() => { setEditingDeptId(null); setForm({ name: '', description: '' }); setShowModal(true); }} className="cursor-pointer bg-white rounded-2xl border-dashed border-2 border-slate-200 hover:border-indigo-300 flex items-center justify-center p-8">
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
                    <p className="text-sm text-slate-500 font-medium">Trưởng phòng: {dept.headNames}</p>
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
                {Array.from({ length: Math.min(dept.members, 4) }).map((_, n) => (
                  <img key={n} src={`https://picsum.photos/seed/user${n}${dept.name}/100/100`} className="w-8 h-8 rounded-full border-2 border-white" alt="avatar" />
                ))}
                {dept.members > 4 && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                    +{dept.members - 4}
                  </div>
                )}
              </div>
              {currentUser?.role === 'ADMIN' ? (
                <div className="flex items-center space-x-2">
                  <button onClick={() => handleManage(dept)} className="text-indigo-600 text-sm font-bold hover:underline">Quản lý</button>
                  <button onClick={() => handleEdit(dept)} className="text-blue-600 text-sm font-bold hover:underline">Sửa</button>
                  <button onClick={() => handleDelete(dept.id)} disabled={deletingId === dept.id} className="text-rose-600 text-sm font-bold hover:underline">{deletingId === dept.id ? 'Đang xóa…' : 'Xóa'}</button>
                </div>
              ) : currentUser?.role === 'MANAGER' ? (
                currentUser?.department === dept.name ? (
                  <button onClick={() => handleManage(dept)} className="text-indigo-600 text-sm font-bold hover:underline">Quản lý</button>
                ) : (
                  <button onClick={() => handleManage(dept)} className="text-blue-600 text-sm font-bold hover:underline">Xem chi tiết</button>
                )
              ) : (
                <button onClick={() => handleManage(dept)} className="text-blue-600 text-sm font-bold hover:underline">Xem chi tiết</button>
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
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mô tả</label>
              <textarea 
                rows={3}
                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
              />
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <p className="font-bold mb-1">💡 Lưu ý:</p>
              <p>Trưởng phòng sẽ được tự động gán từ những nhân viên có vai trò Manager khi thêm vào phòng ban này.</p>
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

      {showManageModal && managingDeptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {currentUser?.role === 'EMPLOYEE' ? `Chi tiết - ${managingDeptData.name}` : `Quản lý - ${managingDeptData.name}`}
              </h3>
              <button onClick={() => setShowManageModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-icons">close</span>
              </button>
            </div>

            {/* Thành viên - Hiển thị cho tất cả */}
            <div>
              <h4 className="text-lg font-bold text-slate-800 mb-4">Thành viên</h4>
                <div className="bg-slate-50 rounded-lg overflow-hidden">
                  {managingDeptData.members.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">Chưa có thành viên</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left font-bold text-slate-700">Tên</th>
                          <th className="px-6 py-3 text-left font-bold text-slate-700">Email</th>
                          <th className="px-6 py-3 text-left font-bold text-slate-700">Vai trò</th>
                        </tr>
                      </thead>
                      <tbody>
                        {managingDeptData.members.map((member: any, idx: number) => (
                          <tr key={idx} className="border-b border-slate-200 hover:bg-slate-100">
                            <td className="px-6 py-3 font-medium text-slate-800">{member.name}</td>
                            <td className="px-6 py-3 text-slate-600">{member.email}</td>
                            <td className="px-6 py-3">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                member.role === 'MANAGER' 
                                  ? 'bg-purple-100 text-purple-700' 
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {member.role === 'MANAGER' ? 'Quản lý' : 'Nhân viên'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            {/* Nhiệm vụ */}
            <div>
              <h4 className="text-lg font-bold text-slate-800 mb-4">Nhiệm vụ đã được giao</h4>
              <div className="bg-slate-50 rounded-lg overflow-hidden">
                {!managingDeptData.tasks || managingDeptData.tasks.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">Chưa có nhiệm vụ nào</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {managingDeptData.tasks.map((task: any, idx: number) => {
                      const assignee = users.find((u: any) => u.id === task.assigneeId || u._id === task.assigneeId);
                      const statusColor = task.status === 'DONE' 
                        ? 'bg-emerald-100 text-emerald-700'
                        : task.status === 'IN_PROGRESS'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-700';
                      return (
                        <div key={idx} className="p-4 hover:bg-slate-100">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-bold text-slate-800">{task.name || task.title}</p>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor}`}>
                              {task.status === 'DONE' ? '✓ Hoàn thành' : task.status === 'IN_PROGRESS' ? '⟳ Đang làm' : '◯ Chưa bắt đầu'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">{task.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            {currentUser?.role !== 'EMPLOYEE' && assignee && <span>👤 {assignee.name}</span>}
                            {task.dueDate && <span>📅 {new Date(task.dueDate).toLocaleDateString('vi-VN')}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* OKR - Chỉ hiển thị cho ADMIN */}
            {currentUser?.role === 'ADMIN' && (currentUser?.role !== 'EMPLOYEE' || managingDeptData.okrs?.length > 0) && (
              <div>
                <h4 className="text-lg font-bold text-slate-800 mb-4">OKR</h4>
                <div className="bg-slate-50 rounded-lg overflow-hidden">
                  {!managingDeptData.okrs || managingDeptData.okrs.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">Chưa có OKR nào</div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {managingDeptData.okrs.map((okr: any, idx: number) => (
                        <div key={idx} className="p-4 hover:bg-slate-100">
                          <p className="font-bold text-slate-800">{okr.name || okr.title}</p>
                          <p className="text-sm text-slate-600 mt-1">{okr.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            {okr.assignee && <span>👤 {users.find((u: any) => u.id === okr.assignee || u._id === okr.assignee)?.name || 'Unknown'}</span>}
                            {okr.department && <span>🏢 {okr.department}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* KPI - Chỉ hiển thị cho EMPLOYEE nếu có, hoặc cho ADMIN/MANAGER xem tất cả */}
            {(currentUser?.role !== 'EMPLOYEE' || managingDeptData.kpis?.length > 0) && (
              <div>
                <h4 className="text-lg font-bold text-slate-800 mb-4">KPI {currentUser?.role === 'EMPLOYEE' ? 'cá nhân' : ''}</h4>
                <div className="bg-slate-50 rounded-lg overflow-hidden">
                  {!managingDeptData.kpis || managingDeptData.kpis.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">Chưa có KPI nào</div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {managingDeptData.kpis.map((kpi: any, idx: number) => (
                        <div key={idx} className="p-4 hover:bg-slate-100">
                          <p className="font-bold text-slate-800">{kpi.name || kpi.title}</p>
                          <p className="text-sm text-slate-600 mt-1">{kpi.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            {currentUser?.role !== 'EMPLOYEE' && kpi.owner && <span>👤 {users.find((u: any) => u.id === kpi.owner || u._id === kpi.owner)?.name || 'Unknown'}</span>}
                            {currentUser?.role !== 'EMPLOYEE' && kpi.department && <span>🏢 {kpi.department}</span>}
                            {kpi.target && <span>🎯 Mục tiêu: {kpi.target}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => setShowManageModal(false)} className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-300">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
