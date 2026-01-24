import { apiRequest } from './apiClient';

export async function getDepartments() {
  try {
    const depts = await apiRequest('/departments');
    return Array.isArray(depts) ? depts : [];
  } catch (err) {
    console.error('API error for departments', err);
    return [];
  }
}

export async function createDepartment(data: { name: string; description?: string }) {
  return apiRequest('/departments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDepartment(id: string, data: { name?: string; description?: string }) {
  return apiRequest(`/departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteDepartment(id: string) {
  return apiRequest(`/departments/${id}`, {
    method: 'DELETE'
  });
}

export async function syncDepartmentHeads(departmentId: string) {
  return apiRequest(`/departments/${departmentId}/sync-heads`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}
