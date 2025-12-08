import 'server-only';

export interface ReflectionDTO {
  id: string;
  basket_id: string;
  workspace_id: string;
  reflection_text: string;
  reflection_target_type?: string;
  reflection_target_id?: string;
  reflection_target_version?: string;
  substrate_window_start?: string;
  substrate_window_end?: string;
  computation_timestamp: string;
  meta?: any;
}

export class ReflectionEngine {
  private backendUrl(): string {
    try {
      // Use shared config helper for consistency with canon
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getApiBaseUrl } = require('@/lib/config/api');
      return getApiBaseUrl();
    } catch {
      return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.yarnnn.com';
    }
  }

  async computeReflection(
    basket_id: string,
    workspace_id: string,
    _options: { force_refresh?: boolean; substrate_window_hours?: number } = {}
  ): Promise<ReflectionDTO | null> {
    const resp = await fetch(`${this.backendUrl()}/api/reflections/compute_window`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id, basket_id, agent_id: 'p3_reflection_agent' })
    });
    if (!resp.ok) throw new Error(`compute_window failed: ${resp.status}`);
    const data = await resp.json();
    return data?.result ?? null;
  }

  async getReflections(
    basket_id: string,
    workspace_id: string,
    cursor?: string,
    limit: number = 10,
    refresh?: boolean
  ): Promise<{ reflections: ReflectionDTO[]; has_more: boolean; next_cursor?: string }> {
    const url = new URL(`${this.backendUrl()}/api/reflections/baskets/${basket_id}`);
    url.searchParams.set('workspace_id', workspace_id);
    url.searchParams.set('limit', String(limit));
    if (cursor) url.searchParams.set('cursor', cursor);
    if (refresh) url.searchParams.set('refresh', 'true');
    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`list basket reflections failed: ${resp.status}`);
    return await resp.json();
  }

  async computeEventReflection(event_id: string, workspace_id: string): Promise<{ success: boolean; reflection_id?: string }> {
    const resp = await fetch(`${this.backendUrl()}/api/reflections/compute_event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id, event_id })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(`compute_event failed: ${resp.status}: ${JSON.stringify(data)}`);
    return data;
  }

  async computeDocumentReflection(document_id: string, workspace_id: string): Promise<{ success: boolean; reflection_id?: string }> {
    const resp = await fetch(`${this.backendUrl()}/api/reflections/documents/${document_id}/compute?workspace_id=${workspace_id}`, { method: 'POST' });
    const data = await resp.json();
    if (!resp.ok) throw new Error(`compute_document failed: ${resp.status}: ${JSON.stringify(data)}`);
    return data;
  }

  async getDocumentReflections(
    document_id: string,
    workspace_id: string,
    cursor?: string,
    limit: number = 10
  ): Promise<{ reflections: ReflectionDTO[]; has_more: boolean; next_cursor?: string }> {
    const url = new URL(`${this.backendUrl()}/api/reflections/documents/${document_id}`);
    url.searchParams.set('workspace_id', workspace_id);
    url.searchParams.set('limit', String(limit));
    if (cursor) url.searchParams.set('cursor', cursor);
    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`list document reflections failed: ${resp.status}`);
    return await resp.json();
  }
}
