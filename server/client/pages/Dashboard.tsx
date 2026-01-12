
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { Objective, MyObjective, Department } from '../types';
import { dataService } from '../services/dataService';
import { getMyOKRs } from '../services/myOkrService';
import { getDepartments } from '../services/departmentService';
import { userService } from '../services/userService';
import { taskService } from '../services/taskService';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Dashboard: React.FC = () => {
  const { selectedPeriod } = useAuth();
  const [okrs, setOkrs] = useState<Objective[]>([]);
  const [myOkrs, setMyOkrs] = useState<MyObjective[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    const [d, myD, depts, usrs, tsks] = await Promise.all([
      dataService.getOKRs(),
      getMyOKRs({ quarter: selectedPeriod.quarter, year: selectedPeriod.year }),
      getDepartments(),
      userService.getUsers(),
      taskService.getTasks()
    ]);
    setOkrs(d);
    setMyOkrs(myD);
    setDepartments(depts);
    setUsers(usrs);
    setTasks(tsks);
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, [selectedPeriod]);

  const filteredOkrs = okrs.filter(o => 
    o.quarter === selectedPeriod.quarter && o.year === selectedPeriod.year
  );

  const filteredMyOkrs = myOkrs.filter(o => 
    o.quarter === selectedPeriod.quarter && o.year === selectedPeriod.year
  );

  const avgProgress = filteredOkrs.length 
    ? Math.round(filteredOkrs.reduce((acc, curr) => acc + curr.progress, 0) / filteredOkrs.length)
    : 0;

  const myAvgProgress = filteredMyOkrs.length 
    ? Math.round(filteredMyOkrs.reduce((acc, curr) => acc + (curr.keyResults.reduce((sum, kr) => sum + kr.progress, 0) / curr.keyResults.length || 0), 0) / filteredMyOkrs.length)
    : 0;

  const deptData = departments.map(d => {
    const deptUsers = users.filter((u: any) => u.department === d.name);
    const deptTasks = tasks.filter((t: any) => deptUsers.some((u: any) => u.id === t.assigneeId));
    const deptTasksDone = deptTasks.filter((t: any) => t.status === 'DONE').length;
    const progress = deptTasks.length > 0 ? Math.round((deptTasksDone / deptTasks.length) * 100) : 0;
    return { name: d.name, progress };
  });

  const stats = [
    { label: 'Tổng mục tiêu', value: filteredOkrs.length.toString(), icon: 'track_changes', color: 'bg-indigo-500' },
    { label: 'Key Results', value: filteredOkrs.reduce((acc, curr) => acc + (curr.keyResults?.length || 0), 0).toString(), icon: 'checklist', color: 'bg-emerald-500' },
    { label: 'Tiến độ trung bình', value: `${avgProgress}%`, icon: 'trending_up', color: 'bg-amber-500' },
    { label: 'Kỳ báo cáo', value: selectedPeriod.quarter + ' ' + selectedPeriod.year, icon: 'calendar_today', color: 'bg-rose-500' },
    { label: 'OKRs cá nhân', value: filteredMyOkrs.length.toString(), icon: 'person', color: 'bg-purple-500' },
    { label: 'Tiến độ cá nhân', value: `${myAvgProgress}%`, icon: 'account_circle', color: 'bg-cyan-500' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Tổng quan {selectedPeriod.quarter} / {selectedPeriod.year}</h2>
        <p className="text-slate-500">Dữ liệu từ hệ thống quản trị OKR nội bộ.</p>
      </div>

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

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold mb-6 flex items-center">
          <span className="material-icons mr-2 text-purple-600">person</span>
          Mục tiêu cá nhân
        </h3>
        <div className="space-y-4">
          {filteredMyOkrs.length > 0 ? (
            filteredMyOkrs.map((okr) => {
              const progress = okr.keyResults.length > 0 ? Math.round(okr.keyResults.reduce((sum, kr) => sum + kr.progress, 0) / okr.keyResults.length) : 0;
              return (
                <div key={okr.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-800">{okr.title}</h4>
                    <p className="text-sm text-slate-500">{okr.keyResults.length} Key Results</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-800">{progress}%</div>
                    <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-slate-400 py-8">
              Chưa có mục tiêu cá nhân nào cho kỳ này
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-6 flex items-center">
            <span className="material-icons mr-2 text-indigo-600">bar_chart</span>
            Tiến độ theo phòng ban
          </h3>
          <div className="h-80 w-full">
            {deptData.length > 0 ? (
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
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 border border-dashed rounded-xl">
                Không có dữ liệu cho kỳ này
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-6 flex items-center">
            <span className="material-icons mr-2 text-indigo-600">pie_chart</span>
            Phân bổ trạng thái
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Hoàn thành tốt (>70%)', value: filteredOkrs.filter(o => o.progress >= 70).length, color: 'bg-emerald-500', total: filteredOkrs.length },
              { label: 'Cần nỗ lực (30-70%)', value: filteredOkrs.filter(o => o.progress >= 30 && o.progress < 70).length, color: 'bg-amber-500', total: filteredOkrs.length },
              { label: 'Rủi ro cao (<30%)', value: filteredOkrs.filter(o => o.progress < 30).length, color: 'bg-rose-500', total: filteredOkrs.length },
            ].map((status, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-slate-600 text-xs">{status.label}</span>
                  <span className="text-slate-800 font-bold">{status.value}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${status.color}`} style={{ width: `${status.total ? (status.value / status.total) * 100 : 0}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 p-4 bg-indigo-50 rounded-xl">
            <p className="text-xs text-indigo-700 leading-relaxed font-medium">
              💡 <span className="font-bold">Gợi ý từ AI:</span> {filteredOkrs.length > 0 ? "Tiến độ đang được duy trì ổn định. Hãy ưu tiên các mục tiêu có tiến độ dưới 50%." : "Chưa có mục tiêu nào được thiết lập cho kỳ này."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
