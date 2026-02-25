import { api } from './api';

export interface GameDetailsDTO {
    game_id: string;
    is_home: boolean;
    date?: string;
    home_team_id?: string;
    away_team_id?: string;
    home_team_name?: string;
    away_team_name?: string;
    score_home?: number;
    score_away?: number;
    possession_home?: number;
    competition_name?: string;
    location?: string;
    status?: string;
    status_id?: number;
    timer_start_at?: string;
    elapsed_time_at_start?: number;
    phase?: string;
    timeline?: TimelineEventDTO[];
}

export interface TimelineEventDTO {
    id: string;
    minute: number;
    action_type_id: number;
    player_id?: string;
    player_name?: string;
    assist_id?: string;
    assist_name?: string;
    comment?: string;
    is_home_event?: boolean;
    is_opponent?: boolean;
    extra_data?: any;
}

export type EventType = 'match' | 'training' | 'meeting' | 'tournament' | 'social' | 'other';

export interface EventDTO {
  event_id: string;
  team_id?: string;
  title: string;
  start_date: string;
  end_date?: string;
  type: EventType;
  status: string;
  status_id?: number; // Added field
  location?: string;
  description?: string;
  lineup_published?: boolean;
  game?: GameDetailsDTO;
  participants?: ParticipantDTO[];
}

const mapEventType = (typeId: number): EventType => {
    switch (typeId) {
        case 1: return 'match';
        case 2: return 'training';
        case 3: return 'meeting';
        case 4: return 'tournament';
        case 5: return 'social';
        default: return 'other';
    }
};

export interface ParticipantDTO {
    member_id: string;
    first_name: string;
    last_name: string;
    role?: string;
    photo_url?: string;
    position?: string;
    status: 'present' | 'absent' | 'maybe' | 'selected' | 'none';
    status_id: number;
    rating?: number;
    motm_votes?: number;
}

export interface EventDetailDTO extends EventDTO {
    participants: ParticipantDTO[];
    my_motm_vote_member_id?: string | null;
    motm_id?: string | null;
    coach_motm_member_id?: string | null;
}

export interface EventCreateDTO {
    type: number;
    title: string;
    start_date: string;
    end_date?: string;
    location?: string;
    description?: string;
}

export interface EventUpdateDTO {
    type?: number;
    title?: string;
    start_date?: string;
    end_date?: string;
    location?: string;
    description?: string;
}

export const eventService = {
  createEvent: async (data: EventCreateDTO): Promise<EventDTO> => {
      const response = await api.post('/core/events', data);
      return response.data;
  },

  updateEvent: async (eventId: string, data: EventUpdateDTO): Promise<EventDTO> => {
      const response = await api.put(`/core/events/${eventId}`, data);
      return response.data;
  },

  cancelEvent: async (eventId: string): Promise<EventDTO> => {
        const response = await api.put(`/core/events/${eventId}/cancel`);
        return response.data;
  },

  reactivateEvent: async (eventId: string): Promise<EventDTO> => {
        const response = await api.put(`/core/events/${eventId}/reactivate`);
        return response.data;
  },

  deleteEvent: async (eventId: string) => {
      // Pass teamId just in case endpoints need context later, though ID is unique
      await api.delete(`/core/events/${eventId}`);
  },

  getEvents: async (teamId?: string, allowedTeamIds?: string[]): Promise<EventDTO[]> => {
    const params = teamId ? { team_id: teamId } : {};
    const response = await api.get<any[]>('/core/events', { params });
    
    // Helper to map status ID to frontend string
    const mapStatus = (statusId: number | null | undefined) => {
        if (statusId === 2) return 'present'; // CONFIRMED
        if (statusId === 6) return 'selected'; // SELECTED
        if (statusId === 3 || statusId === 4) return 'absent';  // DECLINED or EXCUSED
        if (statusId === 1) return 'maybe';   // PENDING
        return 'none';
    };

    let events = response.data.map((e: any) => ({
        event_id: e.event_id,
        team_id: e.team_id,
        title: e.title || "Evénement",
        start_date: e.start_date,
        end_date: e.end_date,
        type: mapEventType(e.type),
        status: mapStatus(e.user_participation_status),
        status_id: e.user_participation_status,
        location: e.location,
        description: e.description,
        game: e.game ? {
            game_id: e.game.game_id,
            is_home: e.game.is_home,
            home_team_name: e.game.home_team_name,
            away_team_name: e.game.away_team_name,
            score_home: e.game.score_home,
            score_away: e.game.score_away,
            competition_name: e.game.competition_name,
            location: e.game.location,
            status: e.game.status,
            status_id: e.game.status_id,
            phase: e.game.phase,
            timer_start_at: e.game.timer_start_at,
            elapsed_time_at_start: e.game.elapsed_time_at_start,
            timeline: e.game.timeline
        } : undefined,
        participants: e.participants ? e.participants.map((p: any) => ({
            member_id: p.member_id,
            first_name: p.first_name || 'Membre',
            last_name: p.last_name || '',
            role: p.role,
            photo_url: p.photo_url,
            status: mapStatus(p.status_id),
            status_id: p.status_id
        })) : []
    }));

    if (!teamId && allowedTeamIds && allowedTeamIds.length > 0) {
        events = events.filter((e: any) => e.team_id && allowedTeamIds.includes(e.team_id));
    }

    return events;
  },

  getEvent: async (id: string, teamId?: string): Promise<EventDetailDTO> => {
      const params = teamId ? { team_id: teamId } : {};
      const response = await api.get<any>(`/core/events/${id}`, { params });
      const e = response.data;
      
      const mapStatus = (statusId: number | null | undefined) => {
          if (statusId === 2) return 'present'; // CONFIRMED
          if (statusId === 6) return 'selected'; // SELECTED
          if (statusId === 3 || statusId === 4) return 'absent';  // DECLINED or EXCUSED
          if (statusId === 1) return 'maybe';   // PENDING
          return 'none';
      };

      return {
          event_id: e.event_id,
          team_id: e.team_id,
          title: e.title || "Evénement",
          start_date: e.start_date,
          end_date: e.end_date,
          type: mapEventType(e.type),
          status: mapStatus(e.user_participation_status),
          status_id: e.user_participation_status,
          lineup_published: e.lineup_published,
          location: e.location,
          description: e.description,
          my_motm_vote_member_id: e.my_motm_vote_member_id ?? null,
          motm_id: e.motm_id ?? null,
          coach_motm_member_id: e.coach_motm_member_id ?? null,
          game: e.game ? {
            game_id: e.game.game_id,
            is_home: e.game.is_home,
            home_team_name: e.game.home_team_name,
            away_team_name: e.game.away_team_name,
            score_home: e.game.score_home,
            score_away: e.game.score_away,
            competition_name: e.game.competition_name,
            location: e.game.location,
            timeline: e.game.timeline,
            status: e.game.status,
            status_id: e.game.status_id,
            phase: e.game.phase,
            timer_start_at: e.game.timer_start_at,
            elapsed_time_at_start: e.game.elapsed_time_at_start
          } : undefined,
          participants: e.participants ? e.participants.map((p: any) => ({
              member_id: p.member_id,
              first_name: p.first_name || 'Membre',
              last_name: p.last_name || '',
              role: p.role,
              photo_url: p.photo_url,
              position: p.position,
              status: mapStatus(p.status_id),
              status_id: p.status_id,
              rating: p.rating,
              motm_votes: p.motm_votes
          })) : []
      };
  },

  getNextMatch: async (teamId?: string, allowedTeamIds?: string[]): Promise<EventDTO | null> => {
      // Logic to get next match. Implementation depends on API capabilities.
      // For now, fetching all and filtering. Returns Next OR Current match (started < 4h ago).
      const events = await eventService.getEvents(teamId, allowedTeamIds);
      
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 4); // Include matches started recently (Live)

      const matches = events
        .filter(e => e.type === 'match' && new Date(e.start_date) > oneDayAgo)
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
      
      return matches.length > 0 ? matches[0] : null;
  },

  getLastMatches: async (count: number = 5, teamId?: string, allowedTeamIds?: string[]): Promise<EventDTO[]> => {
      const events = await eventService.getEvents(teamId, allowedTeamIds);
      return events
        .filter(e => e.type === 'match' && new Date(e.start_date) < new Date())
        .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
        .slice(0, count);
  },


  setParticipation: async (eventId: string, memberId: string, status: 'present' | 'absent' | 'maybe') => {
      // Mapping status based on seed_types.py:
      // 1: PENDING, 2: CONFIRMED, 3: DECLINED, 4: EXCUSED
      let statusId = 1; // Default 'maybe' / pending
      if (status === 'present') statusId = 2;
      if (status === 'absent') statusId = 3; 

      // Backend expects ParticipationUpdate: { member_ids: string[], status_id: number }
      return api.post(`/core/events/${eventId}/participation`, { 
        member_ids: [memberId], 
        status_id: statusId 
      });
  },

  updateParticipationStatus: async (eventId: string, memberIds: string[], statusId: number) => {
      return api.post(`/core/events/${eventId}/participation`, { 
        member_ids: memberIds, 
        status_id: statusId 
      });
  },

addTimelineEvent: async (eventId: string, data: { action_type_id: number; minute: number; player_id?: string; assist_id?: string; comment?: string; is_opponent?: boolean; possession?: number }) => {
      return api.post(`/core/events/${eventId}/timeline`, data);
  },

  deleteTimelineEvent: async (eventId: string, timelineId: string) => {
      return api.delete(`/core/events/${eventId}/timeline/${timelineId}`);
  },

  updateMatchPossession: async (eventId: string, homePossession: number) => {
      return api.put(`/core/events/${eventId}/possession`, { home_possession: homePossession });
  },

  updatePlayerRatings: async (eventId: string, ratings: { member_id: string; rating: number }[]) => {
        // Need wrapper {ratings: [...]}
        return api.put(`/core/events/${eventId}/ratings`, { ratings });
  },

    resetMatch: async (eventId: string) => {
            return api.put(`/core/events/${eventId}/reset`);
    },

  voteForMotm: async (eventId: string, memberId: string) => {
      return api.post(`/core/events/${eventId}/vote_motm`, { voted_member_id: memberId });
    },

    selectMotmByCoach: async (eventId: string, memberId: string) => {
            return api.put(`/core/events/${eventId}/motm`, { member_id: memberId });
    },
};
