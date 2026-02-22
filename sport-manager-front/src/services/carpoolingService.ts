import { api } from './api';

export interface CarpoolDTO {
    id: string;
    event_id: string;
    driver_id: string;
    driver_first_name: string;
    driver_last_name: string;
    available_seats: number;
    departure_location: string;
    departure_time: string;
    note: string;
    passengers: PassengerDTO[];
}

export interface PassengerDTO {
    member_id: string;
    first_name: string;
    last_name: string;
    photo_url?: string;
}

export interface CreateCarpoolDTO {
    event_id: string;
    available_seats: number;
    departure_location: string;
    departure_time: string;
    note?: string;
}

export interface UpdateCarpoolDTO {
    available_seats?: number;
    departure_location?: string;
    departure_time?: string;
    note?: string;
}

export const carpoolingService = {
  getEventCarpools: async (eventId: string): Promise<CarpoolDTO[]> => {
    const response = await api.get<CarpoolDTO[]>(`/carpooling/events/${eventId}/carpools`);
    return response.data;
  },

  createCarpool: async (data: CreateCarpoolDTO): Promise<CarpoolDTO> => {
    const response = await api.post<CarpoolDTO>(`/carpooling/events/${data.event_id}/carpools`, data);
    return response.data;
  },

  updateCarpool: async (carpoolId: string, data: UpdateCarpoolDTO): Promise<CarpoolDTO> => {
      const response = await api.put<CarpoolDTO>(`/carpooling/carpools/${carpoolId}`, data);
      return response.data;
  },

  deleteCarpool: async (carpoolId: string): Promise<void> => {
      await api.delete(`/carpooling/carpools/${carpoolId}`);
  },

  joinCarpool: async (carpoolId: string): Promise<void> => {
      await api.post(`/carpooling/carpools/${carpoolId}/join`);
  },

  leaveCarpool: async (carpoolId: string): Promise<void> => {
      await api.post(`/carpooling/carpools/${carpoolId}/leave`);
  }
};
