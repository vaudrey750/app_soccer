import { api } from './api';

export interface TaskDTO {
    id: string;
    event_id: string;
    type_id: number;
    assigned_member_id: string | null;
    description: string;
    is_completed: boolean;
}

export interface CreateTaskDTO {
    type_id: number;
    description: string;
    assigned_member_ids: string[];
}

export const taskService = {
    getEventTasks: async (eventId: string): Promise<TaskDTO[]> => {
        const response = await api.get(`/tasks/events/${eventId}/tasks`);
        return response.data;
    },

    createTasks: async (eventId: string, data: CreateTaskDTO): Promise<TaskDTO[]> => {
        const response = await api.post(`/tasks/events/${eventId}/tasks`, data);
        return response.data;
    },

    updateTaskStatus: async (taskId: string, isCompleted: boolean): Promise<TaskDTO> => {
        const response = await api.put(`/tasks/${taskId}`, { is_completed: isCompleted });
        return response.data;
    },

    deleteTask: async (taskId: string): Promise<void> => {
        await api.delete(`/tasks/${taskId}`);
    }
};
