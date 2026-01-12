import { Objective, Task, User } from '../types';
import { apiRequest } from './apiClient';

const STORAGE_KEYS = {
  OKRS: 'okr_pro_data_okrs',
  TASKS: 'okr_pro_data_tasks',
  USERS: 'okr_pro_data_users'
};

const INITIAL_USERS: User[] = [
  {
    id: 'admin-1',
    name: 'Quản trị hệ thống',
    email: 'admin@local',
    password: 'admin1234',
    role: 'ADMIN',
    department: 'Ban Giám Đốc',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin'
  }
];

const normalizeId = (item: any) => {
  if (!item) return item;
  if (item._id && !item.id) {
    item.id = item._id;
  }
  // Normalize nested keyResults
  if (item.keyResults && Array.isArray(item.keyResults)) {
    item.keyResults = item.keyResults.map((kr: any) => {
      if (kr._id && !kr.id) {
        kr.id = kr._id;
      }
      return kr;
    });
  }
  return item;
};

export const dataService = {
  // --- Users ---
  getUsers: async (): Promise<User[]> => {
    try {
      const users = await apiRequest('/users', { method: 'GET' });
      const norm = (users || []).map(normalizeId);
      try { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(norm)); } catch(e) {}
      return norm;
    } catch (err) {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
        return INITIAL_USERS;
      }
      return JSON.parse(data);
    }
  },

  saveUser: async (user: Partial<User>) => {
    const isUpdate = !!user.id;

    try {
      let res;
      if (isUpdate) {
        res = await apiRequest(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify(user) });
      } else {
        res = await apiRequest('/users', { method: 'POST', body: JSON.stringify(user) });
      }
      return normalizeId(res);
    } catch (err: any) {
      // --- KHẮC PHỤC LỖI TẠI ĐÂY ---
      // Nếu lỗi là 401 (Hết phiên) hoặc 403 (Không quyền), ném lỗi ra ngoài 
      // để UI xử lý chứ KHÔNG lưu vào LocalStorage (tránh sai lệch dữ liệu)
      if (err.status === 401 || err.status === 403) {
        throw err;
      }

      console.warn("API Error (Network/Server), using LocalStorage fallback", err);
      
      // Chỉ fallback khi lỗi mạng hoặc lỗi server nội bộ (500)
      const users = await dataService.getUsers();
      
      if (isUpdate) {
        const index = users.findIndex(u => u.id === user.id);
        if (index !== -1) {
          users[index] = { ...users[index], ...user } as User;
        }
      } else {
        const newUser = {
          ...user,
          id: user.id || `local-${Date.now()}`,
          role: user.role || 'EMPLOYEE'
        } as User;
        users.push(newUser);
      }
      
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      return isUpdate ? user : users[users.length - 1];
    }
  },

  deleteUser: async (id: string) => {
    try {
      return await apiRequest(`/users/${id}`, { method: 'DELETE' });
    } catch (err: any) {
      // Tương tự: Không cho phép xóa offline nếu server từ chối quyền
      if (err.status === 401 || err.status === 403) {
        throw err;
      }

      console.warn("API Error, deleting locally", err);
      const users = await dataService.getUsers();
      const newUsers = users.filter((u: User) => u.id !== id);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(newUsers));
      return newUsers;
    }
  },

  updateAvatar: async (id: string, avatar: string) => {
    try {
      const res = await apiRequest(`/users/${id}/avatar`, { method: 'PATCH', body: JSON.stringify({ avatar }) });
      return normalizeId(res);
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) throw err;

      const users = await dataService.getUsers();
      const idx = users.findIndex(u => u.id === id);
      if (idx !== -1) {
        users[idx].avatar = avatar;
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        return users[idx];
      }
      throw err;
    }
  },

  // --- OKRs ---
  getOKRs: async (): Promise<Objective[]> => {
    try {
      const okrs = await apiRequest('/okrs', { method: 'GET' });
      return (okrs || []).map(normalizeId);
    } catch (err) {
      const data = localStorage.getItem(STORAGE_KEYS.OKRS);
      return data ? JSON.parse(data) : [];
    }
  },

  saveOKR: async (okr: Partial<Objective>) => {
    try {
      if (okr.id) {
        const res = await apiRequest(`/okrs/${okr.id}`, { method: 'PUT', body: JSON.stringify(okr) });
        return normalizeId(res);
      }
      const res = await apiRequest('/okrs', { method: 'POST', body: JSON.stringify(okr) });
      return normalizeId(res);
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) throw err;

      const okrs = await dataService.getOKRs();
      if (okr.id) {
        const index = okrs.findIndex(o => o.id === okr.id);
        if (index !== -1) okrs[index] = { ...okrs[index], ...okr } as Objective;
      } else {
        okrs.unshift({
          ...(okr as any),
          id: `okr-${Date.now()}`,
          createdAt: new Date().toISOString(),
          progress: 0
        });
      }
      localStorage.setItem(STORAGE_KEYS.OKRS, JSON.stringify(okrs));
      return okrs;
    }
  },

  deleteOKR: async (id: string) => {
    try {
      return await apiRequest(`/okrs/${id}`, { method: 'DELETE' });
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) throw err;

      const okrs = (await dataService.getOKRs()).filter((o: Objective) => o.id !== id);
      localStorage.setItem(STORAGE_KEYS.OKRS, JSON.stringify(okrs));
      return okrs;
    }
  },

  // --- Tasks ---
  getTasks: async (): Promise<Task[]> => {
    try {
      const tasks = await apiRequest('/tasks', { method: 'GET' });
      return (tasks || []).map(normalizeId);
    } catch (err) {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      return data ? JSON.parse(data) : [];
    }
  },

  saveTask: async (task: Partial<Task>) => {
    try {
      const res = await apiRequest('/tasks', { method: 'POST', body: JSON.stringify(task) });
      return normalizeId(res);
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) throw err;

      const tasks = await dataService.getTasks();
      const newTask = { ...task, id: `task-${Date.now()}`, status: 'TODO' } as Task;
      tasks.unshift(newTask);
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
      return newTask;
    }
  },

  updateTaskStatus: async (id: string, status: 'TODO' | 'IN_PROGRESS' | 'DONE') => {
    try {
      const res = await apiRequest(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      return normalizeId(res);
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) throw err;

      const tasks = await dataService.getTasks();
      const index = tasks.findIndex(t => t.id === id);
      if (index !== -1) {
        tasks[index].status = status;
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
        dataService.syncOKRProgress(tasks[index].krId);
        return tasks[index];
      }
      return null;
    }
  },

  updateTask: async (id: string, task: Partial<Task>) => {
    try {
      const res = await apiRequest(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(task) });
      return normalizeId(res);
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) throw err;

      const tasks = await dataService.getTasks();
      const index = tasks.findIndex(t => t.id === id);
      if (index !== -1) {
        tasks[index] = { ...tasks[index], ...task };
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
        dataService.syncOKRProgress(tasks[index].krId);
        return tasks[index];
      }
      return null;
    }
  },

  deleteTask: async (id: string) => {
    try {
      await apiRequest(`/tasks/${id}`, { method: 'DELETE' });
      return true;
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) throw err;

      const tasks = await dataService.getTasks();
      const filtered = tasks.filter(t => t.id !== id);
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(filtered));
      return true;
    }
  },

  syncOKRProgress: async (krId: string) => {
    try {
      await apiRequest('/okrs', { method: 'GET' });
    } catch (err) {
      const okrs = await dataService.getOKRs();
      const tasks = await dataService.getTasks();
      
      okrs.forEach((okr: any) => {
        let changed = false;
        okr.keyResults.forEach((kr: any) => {
          if (kr.id === krId || kr._id === krId) {
            const krTasks = tasks.filter((t: any) => t.krId === krId);
            const doneTasks = krTasks.filter((t: any) => t.status === 'DONE');
            kr.progress = krTasks.length > 0 ? Math.round((doneTasks.length / krTasks.length) * 100) : 0;
            changed = true;
          }
        });
        if (changed) {
          const total = okr.keyResults.reduce((acc: number, cur: any) => acc + (cur.progress || 0), 0);
          okr.progress = okr.keyResults.length ? Math.round(total / okr.keyResults.length) : 0;
        }
      });
      localStorage.setItem(STORAGE_KEYS.OKRS, JSON.stringify(okrs));
    }
  }
};