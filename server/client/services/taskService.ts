import { apiRequest } from './apiClient';

async function getTasks(params?: {
    assigneeId?: string;
    krId?: string;
    status?: string;
}) {
    const filteredParams = params ? Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    ) : {};
    const qs = Object.keys(filteredParams).length > 0
        ? `?${new URLSearchParams(Object.entries(filteredParams).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {}))}`
        : '';
    return apiRequest(`/tasks${qs}`);
}

async function createTask(payload: any) {
    return apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}

async function updateTask(id: string, payload: any) {
    return apiRequest(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });
}

async function deleteTask(id: string) {
    return apiRequest(`/tasks/${id}`, { method: 'DELETE' });
}

export const taskService = {
    getTasks,
    createTask,
    updateTask,
    deleteTask
};