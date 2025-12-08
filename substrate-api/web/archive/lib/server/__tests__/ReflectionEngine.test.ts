import { ReflectionEngine } from '../ReflectionEngine';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

jest.mock('@supabase/auth-helpers-nextjs');
jest.mock('next/headers');

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

(createRouteHandlerClient as jest.Mock).mockReturnValue(mockSupabase);

describe('ReflectionEngine', () => {
  let engine: ReflectionEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ReflectionEngine();
  });

  describe('computeReflection', () => {
    it('should compute and store a reflection', async () => {
      const basket_id = 'test-basket-id';
      const mockDumps = [
        { text_dump: 'First memory', file_url: null, created_at: '2025-01-01T00:00:00Z' },
        { text_dump: 'Second memory', file_url: null, created_at: '2025-01-01T01:00:00Z' },
      ];
      const mockReflection = {
        id: 'reflection-id',
        basket_id,
        reflection_text: 'Test reflection',
        substrate_window_start: '2025-01-01T00:00:00Z',
        substrate_window_end: '2025-01-02T00:00:00Z',
        computation_timestamp: '2025-01-02T00:00:00Z',
        meta: { computation_trace_id: 'trace-id', substrate_dump_count: 2, substrate_tokens: 6 },
      };

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                lte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: mockDumps,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockReflection,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        });

      const result = await engine.computeReflection(basket_id, 'workspace-123');

      expect(result?.basket_id).toBe(basket_id);
      expect(result?.reflection_text).toBe('Test reflection');
      expect(mockSupabase.from).toHaveBeenCalledWith('raw_dumps');
      expect(mockSupabase.from).toHaveBeenCalledWith('reflection_cache');
      expect(mockSupabase.from).toHaveBeenCalledWith('timeline_events');
    });

    it('should handle database errors when storing reflection', async () => {
      const basket_id = 'test-basket-id';

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                lte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        });

      await expect(engine.computeReflection(basket_id, 'workspace-123')).rejects.toThrow('Failed to store reflection: Database error');
    });
  });

  describe('getReflections', () => {
    it('should fetch reflections with pagination', async () => {
      const basket_id = 'test-basket-id';
      const mockReflections = [
        {
          id: 'reflection-1',
          basket_id,
          reflection_text: 'First reflection',
          substrate_window_start: '2025-01-01T00:00:00Z',
          substrate_window_end: '2025-01-02T00:00:00Z',
          computation_timestamp: '2025-01-02T00:00:00Z',
          meta: {},
        },
        {
          id: 'reflection-2',
          basket_id,
          reflection_text: 'Second reflection',
          substrate_window_start: '2025-01-02T00:00:00Z',
          substrate_window_end: '2025-01-03T00:00:00Z',
          computation_timestamp: '2025-01-03T00:00:00Z',
          meta: {},
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockReflections,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await engine.getReflections(basket_id, 'workspace-123', undefined, 10, false);

      expect(result.reflections).toHaveLength(2);
      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeUndefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('reflection_cache');
    });

    it('should handle cursor-based pagination', async () => {
      const basket_id = 'test-basket-id';
      const cursor = '2025-01-02T00:00:00Z';

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lt: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      await engine.getReflections(basket_id, 'workspace-123', cursor, 10, false);

      expect(mockSupabase.from().select().eq().order().limit().lt).toHaveBeenCalledWith('computation_timestamp', cursor);
    });
  });
});