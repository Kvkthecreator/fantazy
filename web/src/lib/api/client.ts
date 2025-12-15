/**
 * Fantazy API Client
 */

import { createClient } from "@/lib/supabase/client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:10000";

export class APIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = "APIError";
  }
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  return headers;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    throw new APIError(response.status, response.statusText, data);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export const api = {
  // User endpoints
  users: {
    me: () => request<import("@/types").User>("/users/me"),
    update: (data: import("@/types").UserUpdate) =>
      request<import("@/types").User>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    usage: () => request<import("@/types").UsageResponse>("/users/me/usage"),
  },

  // Character endpoints
  characters: {
    list: (params?: { archetype?: string; include_premium?: boolean }) => {
      const searchParams = new URLSearchParams();
      if (params?.archetype) searchParams.set("archetype", params.archetype);
      if (params?.include_premium !== undefined)
        searchParams.set("include_premium", String(params.include_premium));
      const query = searchParams.toString();
      return request<import("@/types").CharacterSummary[]>(
        `/characters${query ? `?${query}` : ""}`
      );
    },
    get: (id: string) =>
      request<import("@/types").Character>(`/characters/${id}`),
    getBySlug: (slug: string) =>
      request<import("@/types").Character>(`/characters/slug/${slug}`),
    getProfile: (slug: string) =>
      request<import("@/types").CharacterProfile>(`/characters/slug/${slug}/profile`),
    archetypes: () => request<string[]>("/characters/archetypes/list"),
  },

  // Relationship endpoints
  relationships: {
    list: (include_archived?: boolean) =>
      request<import("@/types").RelationshipWithCharacter[]>(
        `/relationships${include_archived ? "?include_archived=true" : ""}`
      ),
    create: (character_id: string) =>
      request<import("@/types").Relationship>("/relationships", {
        method: "POST",
        body: JSON.stringify({ character_id }),
      }),
    get: (id: string) =>
      request<import("@/types").Relationship>(`/relationships/${id}`),
    getByCharacter: (character_id: string) =>
      request<import("@/types").Relationship>(
        `/relationships/character/${character_id}`
      ),
    update: (
      id: string,
      data: {
        nickname?: string;
        is_favorite?: boolean;
        is_archived?: boolean;
        relationship_notes?: string;
      }
    ) =>
      request<import("@/types").Relationship>(`/relationships/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  // Episode endpoints
  episodes: {
    list: (params?: {
      character_id?: string;
      active_only?: boolean;
      limit?: number;
      offset?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.character_id)
        searchParams.set("character_id", params.character_id);
      if (params?.active_only)
        searchParams.set("active_only", String(params.active_only));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.offset) searchParams.set("offset", String(params.offset));
      const query = searchParams.toString();
      return request<import("@/types").EpisodeSummary[]>(
        `/episodes${query ? `?${query}` : ""}`
      );
    },
    get: (id: string) => request<import("@/types").Episode>(`/episodes/${id}`),
    getActive: (character_id: string) =>
      request<import("@/types").Episode | null>(
        `/episodes/active/${character_id}`
      ),
    create: (data: {
      character_id: string;
      scene?: string;
      title?: string;
    }) =>
      request<import("@/types").Episode>("/episodes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: { title?: string; scene?: string; is_active?: boolean }
    ) =>
      request<import("@/types").Episode>(`/episodes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    end: (id: string) =>
      request<import("@/types").Episode>(`/episodes/${id}/end`, {
        method: "POST",
      }),
  },

  // Episode Template endpoints (pre-defined scenarios)
  episodeTemplates: {
    listForCharacter: (characterId: string) =>
      request<import("@/types").EpisodeTemplateSummary[]>(
        `/episode-templates/character/${characterId}`
      ),
    get: (templateId: string) =>
      request<import("@/types").EpisodeTemplate>(`/episode-templates/${templateId}`),
    getDefault: (characterId: string) =>
      request<import("@/types").EpisodeTemplate>(
        `/episode-templates/character/${characterId}/default`
      ),
  },

  // Message endpoints
  messages: {
    list: (episode_id: string, params?: { limit?: number; before_id?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.before_id) searchParams.set("before_id", params.before_id);
      const query = searchParams.toString();
      return request<import("@/types").Message[]>(
        `/episodes/${episode_id}/messages${query ? `?${query}` : ""}`
      );
    },
    recent: (episode_id: string, limit?: number) =>
      request<import("@/types").Message[]>(
        `/episodes/${episode_id}/messages/recent${limit ? `?limit=${limit}` : ""}`
      ),
  },

  // Conversation endpoints
  conversation: {
    send: (character_id: string, content: string) =>
      request<import("@/types").Message>(`/conversation/${character_id}/send`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    sendStream: async function* (character_id: string, content: string) {
      const headers = await getAuthHeaders();

      const response = await fetch(
        `${API_BASE_URL}/conversation/${character_id}/send/stream`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        let data;
        try {
          data = await response.json();
        } catch {
          data = null;
        }
        throw new APIError(response.status, response.statusText, data);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              return;
            }
            if (data.startsWith("[ERROR]")) {
              throw new Error(data.slice(8));
            }
            try {
              const parsed = JSON.parse(data);
              yield parsed;
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    },
    context: (character_id: string) =>
      request<import("@/types").ConversationContext>(
        `/conversation/${character_id}/context`
      ),
    start: (character_id: string, options?: { scene?: string; episodeTemplateId?: string }) => {
      const params = new URLSearchParams();
      if (options?.scene) params.set("scene", options.scene);
      if (options?.episodeTemplateId) params.set("episode_template_id", options.episodeTemplateId);
      const query = params.toString();
      return request<import("@/types").Episode>(
        `/conversation/${character_id}/start${query ? `?${query}` : ""}`,
        { method: "POST" }
      );
    },
    end: (character_id: string) =>
      request<import("@/types").Episode>(`/conversation/${character_id}/end`, {
        method: "POST",
      }),
  },

  // Memory endpoints
  memory: {
    list: (params?: {
      character_id?: string;
      types?: string[];
      min_importance?: number;
      limit?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.character_id)
        searchParams.set("character_id", params.character_id);
      if (params?.types)
        params.types.forEach((t) => searchParams.append("types", t));
      if (params?.min_importance)
        searchParams.set("min_importance", String(params.min_importance));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      const query = searchParams.toString();
      return request<import("@/types").MemoryEvent[]>(
        `/memory${query ? `?${query}` : ""}`
      );
    },
    relevant: (character_id: string, limit?: number) =>
      request<import("@/types").MemoryEvent[]>(
        `/memory/relevant?character_id=${character_id}${limit ? `&limit=${limit}` : ""}`
      ),
    delete: (id: string) =>
      request<null>(`/memory/${id}`, { method: "DELETE" }),
  },

  // Scene endpoints
  scenes: {
    generate: (data: import("@/types").SceneGenerateRequest) =>
      request<import("@/types").SceneGenerateResponse>("/scenes/generate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listForEpisode: (episode_id: string) =>
      request<import("@/types").EpisodeImage[]>(`/scenes/episode/${episode_id}`),
    toggleMemory: (episode_image_id: string, is_memory: boolean) =>
      request<import("@/types").EpisodeImage>(`/scenes/${episode_image_id}/memory`, {
        method: "PATCH",
        body: JSON.stringify({ is_memory }),
      }),
    listMemories: (params?: { character_id?: string; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.character_id)
        searchParams.set("character_id", params.character_id);
      if (params?.limit) searchParams.set("limit", String(params.limit));
      const query = searchParams.toString();
      return request<import("@/types").SceneMemory[]>(
        `/scenes/memories${query ? `?${query}` : ""}`
      );
    },
  },

  // Hook endpoints
  hooks: {
    list: (params?: {
      character_id?: string;
      active_only?: boolean;
      pending_only?: boolean;
      limit?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.character_id)
        searchParams.set("character_id", params.character_id);
      if (params?.active_only !== undefined)
        searchParams.set("active_only", String(params.active_only));
      if (params?.pending_only)
        searchParams.set("pending_only", String(params.pending_only));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      const query = searchParams.toString();
      return request<import("@/types").Hook[]>(
        `/hooks${query ? `?${query}` : ""}`
      );
    },
    pending: (character_id: string, limit?: number) =>
      request<import("@/types").Hook[]>(
        `/hooks/pending/${character_id}${limit ? `?limit=${limit}` : ""}`
      ),
  },

  // Subscription endpoints
  subscription: {
    getStatus: () =>
      request<import("@/types").SubscriptionStatus>("/subscription/status"),
    createCheckout: (variantId?: string) =>
      request<import("@/types").CheckoutResponse>("/subscription/checkout", {
        method: "POST",
        body: JSON.stringify({ variant_id: variantId }),
      }),
    getPortal: () =>
      request<import("@/types").PortalResponse>("/subscription/portal"),
  },

  // Credits (Sparks) endpoints
  credits: {
    getBalance: () =>
      request<import("@/types").SparkBalance>("/credits/balance"),
    check: (featureKey: string) =>
      request<import("@/types").SparkCheck>(`/credits/check/${featureKey}`),
    getHistory: (limit?: number, offset?: number) => {
      const params = new URLSearchParams();
      if (limit) params.set("limit", String(limit));
      if (offset) params.set("offset", String(offset));
      const query = params.toString();
      return request<import("@/types").SparkTransactionHistory>(
        `/credits/history${query ? `?${query}` : ""}`
      );
    },
    getCosts: () =>
      request<import("@/types").FeatureCost[]>("/credits/costs"),
  },

  // Top-up endpoints
  topup: {
    getPacks: () =>
      request<import("@/types").TopupPack[]>("/topup/packs"),
    checkout: (packName: string) =>
      request<import("@/types").TopupCheckoutResponse>("/topup/checkout", {
        method: "POST",
        body: JSON.stringify({ pack_name: packName }),
      }),
  },

  // Studio endpoints (character creation/management)
  studio: {
    listCharacters: (statusFilter?: "draft" | "active") => {
      const params = statusFilter ? `?status_filter=${statusFilter}` : "";
      return request<import("@/types").CharacterSummary[]>(`/studio/characters${params}`);
    },
    getCharacter: (id: string) =>
      request<import("@/types").Character>(`/studio/characters/${id}`),
    createCharacter: (data: {
      name: string;
      archetype: string;
      avatar_url?: string | null;
      personality_preset?: string;
      baseline_personality?: Record<string, unknown>;
      boundaries?: Record<string, unknown>;
      content_rating?: string;
      opening_situation: string;
      opening_line: string;
      status?: "draft" | "active";
    }) =>
      request<{ id: string; slug: string; name: string; status: string; message: string }>(
        "/studio/characters",
        { method: "POST", body: JSON.stringify(data) }
      ),
    updateCharacter: (id: string, data: Record<string, unknown>) =>
      request<import("@/types").Character>(`/studio/characters/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    activateCharacter: (id: string) =>
      request<import("@/types").Character>(`/studio/characters/${id}/activate`, {
        method: "POST",
      }),
    deactivateCharacter: (id: string) =>
      request<import("@/types").Character>(`/studio/characters/${id}/deactivate`, {
        method: "POST",
      }),
    deleteCharacter: (id: string) =>
      request<null>(`/studio/characters/${id}`, { method: "DELETE" }),
    getArchetypes: () =>
      request<{ archetypes: string[] }>("/studio/archetypes"),
    getPersonalityPresets: () =>
      request<{ presets: Record<string, unknown> }>("/studio/personality-presets"),
    getDefaultBoundaries: () =>
      request<{ boundaries: Record<string, unknown> }>("/studio/default-boundaries"),
    // Conversation Ignition endpoints
    generateOpeningBeat: (data: {
      name: string;
      archetype: string;
      personality?: Record<string, unknown>;
      personality_preset?: string;
      boundaries?: Record<string, unknown>;
      content_rating?: string;
      world_context?: string;
    }) =>
      request<import("@/types").OpeningBeatResponse>("/studio/generate-opening-beat", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    regenerateOpeningBeat: (
      characterId: string,
      data: {
        previous_situation: string;
        previous_line: string;
        feedback?: string;
      }
    ) =>
      request<import("@/types").OpeningBeatResponse>(
        `/studio/characters/${characterId}/regenerate-opening-beat`,
        { method: "POST", body: JSON.stringify(data) }
      ),
    applyOpeningBeat: (
      characterId: string,
      data: {
        opening_situation: string;
        opening_line: string;
        starter_prompts?: string[];
      }
    ) =>
      request<import("@/types").Character>(
        `/studio/characters/${characterId}/apply-opening-beat`,
        { method: "POST", body: JSON.stringify(data) }
      ),
    getArchetypeRules: (archetype: string) =>
      request<import("@/types").ArchetypeRulesResponse>(
        `/studio/archetype-rules/${archetype}`
      ),
    // Avatar Generation (Phase 4.1 & 4.2)
    generateAvatar: (characterId: string, appearanceDescription?: string) =>
      request<import("@/types").AvatarGenerationResponse>(
        `/studio/characters/${characterId}/generate-avatar`,
        {
          method: "POST",
          body: JSON.stringify({ appearance_description: appearanceDescription }),
        }
      ),
    generateExpression: (characterId: string, expression: string) =>
      request<import("@/types").AvatarGenerationResponse>(
        `/studio/characters/${characterId}/generate-expression`,
        {
          method: "POST",
          body: JSON.stringify({ expression }),
        }
      ),
    getAvatarStatus: (characterId: string) =>
      request<import("@/types").AvatarStatusResponse>(
        `/studio/characters/${characterId}/avatar-status`
      ),
    getExpressionTypes: () =>
      request<import("@/types").ExpressionTypesResponse>("/studio/expression-types"),
    // Admin / Calibration endpoints
    fixAvatarUrls: () =>
      request<{ message: string; results: Array<{ name: string; status: string }> }>(
        "/studio/admin/fix-avatar-urls",
        { method: "POST" }
      ),
    batchCreate: (characters: Array<{
      name: string;
      archetype: string;
      personality_preset?: string;
      content_rating?: string;
      appearance_hint?: string;
    }>) =>
      request<{
        message: string;
        results: Array<{ name: string; status: string; id?: string; appearance_hint?: string }>;
      }>("/studio/admin/batch-create", {
        method: "POST",
        body: JSON.stringify({ characters }),
      }),

    // Episode Template Management (Studio)
    listEpisodeTemplates: (characterId: string, includeAll?: boolean) => {
      const status = includeAll ? "" : "?status=active";
      return request<import("@/types").EpisodeTemplateSummary[]>(
        `/episode-templates/character/${characterId}${status}`
      );
    },
    getEpisodeTemplate: (templateId: string) =>
      request<import("@/types").EpisodeTemplate>(`/episode-templates/${templateId}`),
    createEpisodeTemplate: (data: {
      character_id: string;
      episode_number: number;
      title: string;
      slug: string;
      situation: string;
      opening_line: string;
      episode_frame?: string;
      is_default?: boolean;
    }) =>
      request<import("@/types").EpisodeTemplate>("/episode-templates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateEpisodeTemplate: (
      templateId: string,
      data: {
        title?: string;
        situation?: string;
        opening_line?: string;
        episode_frame?: string;
        status?: string;
      }
    ) =>
      request<import("@/types").EpisodeTemplate>(`/episode-templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    activateEpisodeTemplate: (templateId: string) =>
      request<import("@/types").EpisodeTemplate>(`/episode-templates/${templateId}/activate`, {
        method: "POST",
      }),
    generateEpisodeBackground: (characterName: string, episodeNumber: number) =>
      request<{ message: string; generated: number }>(
        `/studio/admin/generate-episode-backgrounds?character=${encodeURIComponent(characterName)}&episode_number=${episodeNumber}`,
        { method: "POST" }
      ),
  },
};

export default api;
