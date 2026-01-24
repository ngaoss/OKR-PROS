import { User } from '../types';
import { apiRequest } from './apiClient';

// Helper chuẩn hóa ID (đảm bảo luôn có field 'id')
const normalizeId = (item: any) => {
  if (!item) return item;
  if (item._id && !item.id) {
    item.id = item._id;
  }
  return item;
};

export const userService = {
  getUsers: async (): Promise<User[]> => {
    try {
      const users = await apiRequest('/users', { method: 'GET' });
      const userArray = Array.isArray(users) ? users : [];
      return userArray.map(normalizeId);
    } catch (err) {
      console.error('API error for users, falling back to local', err);
      try {
        const data = localStorage.getItem('okr_pro_data_users');
        if (data) {
          const parsed = JSON.parse(data);
          return Array.isArray(parsed) ? parsed : [];
        }
      } catch (e) {
        // localStorage parse error, ignore
      }
      return [];
    }
  },

  // Hàm save thông minh: Tự động chọn POST (tạo mới) hoặc PUT (cập nhật) dựa vào id
  saveUser: async (user: Partial<User>) => {
    const isUpdate = !!user.id;
    let res;
    
    // Nếu có ID -> Update, ngược lại -> Create
    if (isUpdate) {
      res = await apiRequest(`/users/${user.id}`, { 
        method: 'PUT', 
        body: JSON.stringify(user) 
      });
    } else {
      res = await apiRequest('/users', { 
        method: 'POST', 
        body: JSON.stringify(user) 
      });
    }
    
    return normalizeId(res);
  },

  // Wrapper cho code cũ: tạo mới user
  createUser: async (user: Partial<User>) => {
    // Đảm bảo không có id khi tạo mới
    const { id, ...rest } = user;
    return userService.saveUser(rest);
  },

  // Wrapper cho code cũ: cập nhật user
  updateUser: async (id: string, user: Partial<User>) => {
    // Đảm bảo id đúng
    return userService.saveUser({ ...user, id });
  },

  deleteUser: async (id: string) => {
    return await apiRequest(`/users/${id}`, { method: 'DELETE' });
  },

  updateAvatar: async (id: string, avatar: string) => {
    const res = await apiRequest(`/users/${id}/avatar`, { 
      method: 'PATCH', 
      body: JSON.stringify({ avatar }) 
    });
    return normalizeId(res);
  },

  changePassword: async (id: string, password: string) => {
    return await apiRequest(`/users/${id}/password`, {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  }
};