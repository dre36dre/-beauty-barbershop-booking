import { describe, expect, it, vi } from 'vitest';
import { availableTimes } from './booking.js';

describe('availableTimes', () => {
  it('uses the public opening hours instead of a configured professional schedule', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 1, nome: 'Vanessa Souza', duracao: 45 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const executor = { query } as never;

    const times = await availableTimes('2099-12-01', 1, [1], executor);

    expect(times?.[0]).toBe('10:00');
    expect(times).toContain('17:15');
    expect(times).not.toContain('17:30');
    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('barbeiros_horariotrabalho'))).toBe(false);
  });
});
