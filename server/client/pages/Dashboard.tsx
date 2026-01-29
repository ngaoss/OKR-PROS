import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis 
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { Objective, MyObjective, Department } from '../types';
import { dataService } from '../services/dataService';
import { getMyOKRs } from '../services/myOkrService';
import { getDepartments } from '../services/departmentService';
import { userService } from '../services/userService';
import { taskService } from '../services/taskService';

// Định nghĩa màu sắc hệ thống
const CHART_COLORS = {
  ALERT: '#ef4444',       // Đỏ
  PROGRESS: '#3b82f6',    // Xanh nước biển
  TODO: '#94a3b8',        // Xám
  DONE: '#10b981'         // Xanh lá
};

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Dashboard: React.FC = () => {
  const { selectedPeriod } = useAuth();
  const [okrs, setOkrs] = useState<Objective[]>([]);
  const [myOkrs, setMyOkrs] = useState<MyObjective[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [focusDept, setFocusDept] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [d, myD, depts, usrs, tsks] = await Promise.all([
        dataService.getOKRs(),
        getMyOKRs({ quarter: selectedPeriod.quarter, year: selectedPeriod.year }),
        getDepartments(),
        userService.getUsers(),
        taskService.getTasks()
      ]);
      setOkrs(d || []);
      setMyOkrs(myD || []);
      setDepartments(depts || []);
      setUsers(usrs || []);
      setTasks(tsks || []);
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedPeriod]);

  // Lọc OKRs theo kỳ
  const filteredOkrs = useMemo(() => 
    okrs.filter(o => o.quarter === selectedPeriod.quarter && o.year === selectedPeriod.year),
    [okrs, selectedPeriod]
  );

  const filteredMyOkrs = useMemo(() => 
    myOkrs.filter(o => o.quarter === selectedPeriod.quarter && o.year === selectedPeriod.year),
    [myOkrs, selectedPeriod]
  );

  const avgProgress = filteredOkrs.length 
    ? Math.round(filteredOkrs.reduce((acc, curr) => acc + (curr.progress || 0), 0) / filteredOkrs.length)
    : 0;

  const myAvgProgress = filteredMyOkrs.length 
    ? Math.round(filteredMyOkrs.reduce((acc, curr) => {
        const krAvg = curr.keyResults?.length 
          ? curr.keyResults.reduce((sum, kr) => sum + (kr.progress || 0), 0) / curr.keyResults.length 
          : 0;
        return acc + krAvg;
      }, 0) / filteredMyOkrs.length)
    : 0;

  const deptData = departments.map(d => {
    const deptUsers = users.filter((u: any) => u.department === d.name);
    const deptTasks = tasks.filter((t: any) => deptUsers.some((u: any) => u.id === t.assigneeId));
    const deptTasksDone = deptTasks.filter((t: any) => t.status === 'DONE').length;
    const progress = deptTasks.length > 0 ? Math.round((deptTasksDone / deptTasks.length) * 100) : 0;
    return { name: d.name, progress };
  });

  // LOGIC PHÂN LOẠI CHI TIẾT NHIỆM VỤ
  const taskAnalysis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alertTasks: any[] = [];
    const doneTasks: any[] = [];
    const otherTasks: any[] = [];

    tasks.forEach(task => {
      if (task.status === 'DONE') {
        doneTasks.push(task);
        return;
      }

      let diffDays = 999;
      let alertReason = "";
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        const diffTime = dueDate.getTime() - today.getTime();
        diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      let isAlert = false;
      if (diffDays <= 3) {
        isAlert = true;
        alertReason = "Chỉ còn < 3 ngày!";
      } else if (task.status === 'TODO' && diffDays <= 12) {
        isAlert = true;
        alertReason = "Chưa làm & còn < 12 ngày";
      } else if (task.status === 'IN_PROGRESS' && diffDays <= 7) {
        isAlert = true;
        alertReason = "Đang làm & còn < 7 ngày";
      }

      if (isAlert) {
        alertTasks.push({ ...task, alertReason, diffDays });
      } else {
        otherTasks.push(task);
      }
    });

    alertTasks.sort((a, b) => a.diffDays - b.diffDays);
    return { alertTasks, doneTasks, otherTasks };
  }, [tasks]);

  const deptProgressData = useMemo(() => {
    return departments.map(dept => {
      const deptOkrs = filteredOkrs.filter(o => o.department === dept.name);
      const avg = deptOkrs.length > 0
        ? Math.round(deptOkrs.reduce((acc, curr) => acc + (curr.progress || 0), 0) / deptOkrs.length)
        : 0;
      return { name: dept.name, progress: avg, count: deptOkrs.length };
    });
  }, [departments, filteredOkrs]);

  const displayProgress = useMemo(() => {
    if (focusDept) {
      const dept = deptProgressData.find(d => d.name === focusDept);
      return dept ? dept.progress : 0;
    }
    return avgProgress;
  }, [focusDept, deptProgressData, avgProgress]);

  const progressChartData = [{ name: 'Tiến độ', value: displayProgress, fill: '#6366f1' }];

  const stats = [
    { label: 'Tổng mục tiêu', value: filteredOkrs.length.toString(), icon: 'track_changes', color: 'bg-indigo-500' },
    { label: 'Key Results', value: filteredOkrs.reduce((acc, curr) => acc + (curr.keyResults?.length || 0), 0).toString(), icon: 'checklist', color: 'bg-emerald-500' },
    { label: 'Tiến độ trung bình', value: `${avgProgress}%`, icon: 'trending_up', color: 'bg-amber-500' },
    { label: 'Kỳ báo cáo', value: `${selectedPeriod.quarter} ${selectedPeriod.year}`, icon: 'calendar_today', color: 'bg-rose-500' },
    { label: 'OKRs cá nhân', value: filteredMyOkrs.length.toString(), icon: 'person', color: 'bg-purple-500' },
    { label: 'Tiến độ cá nhân', value: `${myAvgProgress}%`, icon: 'account_circle', color: 'bg-cyan-500' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Tổng quan {selectedPeriod.quarter} / {selectedPeriod.year}</h2>
        <p className="text-slate-500">Dữ liệu từ hệ thống quản trị OKR nội bộ.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className={`${stat.color} p-3 rounded-xl text-white`}>
              <span className="material-icons">{stat.icon}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Biểu đồ phòng ban */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-6 flex items-center">
            <span className="material-icons mr-2 text-indigo-600">bar_chart</span>
            Tiến độ theo phòng ban (Nhiệm vụ)
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="progress" radius={[4, 4, 0, 0]}>
                  {deptData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Phân bổ trạng thái */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-6 flex items-center">
            <span className="material-icons mr-2 text-indigo-600">pie_chart</span>
            Phân bổ mục tiêu
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Hoàn thành tốt (>70%)', value: filteredOkrs.filter(o => (o.progress || 0) >= 70).length, color: 'bg-emerald-500' },
              { label: 'Cần nỗ lực (30-70%)', value: filteredOkrs.filter(o => (o.progress || 0) >= 30 && (o.progress || 0) < 70).length, color: 'bg-amber-500' },
              { label: 'Rủi ro cao (<30%)', value: filteredOkrs.filter(o => (o.progress || 0) < 30).length, color: 'bg-rose-500' },
            ].map((status, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-slate-600 text-xs">{status.label}</span>
                  <span className="text-slate-800 font-bold">{status.value}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${status.color}`} style={{ width: `${filteredOkrs.length ? (status.value / filteredOkrs.length) * 100 : 0}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 p-4 bg-indigo-50 rounded-xl text-xs text-indigo-700 font-medium">
            💡 <b>AI gợi ý:</b> {filteredOkrs.length > 0 ? "Tiến độ duy trì ổn định. Ưu tiên các mục tiêu < 50%." : "Hãy thiết lập mục tiêu cho kỳ này."}
          </div>
        </div>
      </div>

      {/* --- PHẦN 1+2: TIẾN ĐỘ RADIAL (TRÁI) & NHIỆM VỤ CẦN CHÚ Ý (PHẢI) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-4">
            <h3 className="text-xl font-black text-slate-800">{focusDept || 'Tiến độ toàn Công Ty'}</h3>
            {focusDept && <button onClick={() => setFocusDept(null)} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 uppercase">Hủy lọc</button>}
          </div>
          <div className="relative h-[300px] w-full max-w-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="75%" outerRadius="100%" barSize={26} data={progressChartData} startAngle={90} endAngle={450}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={13} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-6xl font-black text-slate-900">{displayProgress}%</span>
              <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Progress</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <h3 className="text-xl font-black text-slate-800 flex items-center mb-6">
            <span className="material-icons mr-2 text-amber-500">list_alt</span>
            Nhiệm vụ Cần Chú Ý
          </h3>
          <div className="overflow-y-auto max-h-[420px] pr-2">
            {taskAnalysis.alertTasks.length > 0 ? (
              <div className="space-y-3">
                {taskAnalysis.alertTasks.map((task, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-rose-50/50 rounded-2xl border border-rose-100 hover:shadow-md transition-all">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 truncate">{task.title}</p>
                      <div className="flex items-center mt-1 space-x-3 text-xs">
                        <span className="text-slate-500 font-bold flex items-center">
                          <span className="material-icons text-sm mr-1">event</span> {task.dueDate}
                        </span>
                        <span className="text-rose-600 font-black italic bg-white px-2 py-0.5 rounded shadow-sm flex items-center">
                          <span className="material-icons text-xs mr-1">warning</span> {task.alertReason}
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-white text-rose-500 rounded-full text-[10px] font-black border border-rose-200 uppercase">
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 font-bold">
                <span className="material-icons text-5xl block opacity-20">check_circle</span>
                Không có cảnh báo nào!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- PHẦN 3: NHIỆM VỤ ĐÃ XONG --- */}
      {taskAnalysis.doneTasks.length > 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <h3 className="text-xl font-black text-emerald-600 mb-6 flex items-center">
            <span className="material-icons mr-2">task_alt</span> Nhiệm vụ Đã Hoàn Thành
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {taskAnalysis.doneTasks.slice(0, 6).map((task, i) => (
              <div key={i} className="flex items-center p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mr-3">
                  <span className="material-icons text-emerald-600 text-sm">check</span>
                </div>
                <p className="font-bold text-slate-700 text-sm truncate">{task.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};