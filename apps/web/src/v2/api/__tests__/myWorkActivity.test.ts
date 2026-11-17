import { beforeEach, describe, expect, it, vi } from 'vitest';
const { getApi } = vi.hoisted(() => ({ getApi: vi.fn() }));
vi.mock('../../../api/client', () => ({ getApi }));
import { fetchMyWorkActivity } from '../myWorkActivity';

const row = (id: string, updatedAt = '2026-11-02T10:00:00Z') => ({ id, applicationCode: 'APP-1', primaryRecruiterId: 'me', candidate: { firstName: 'Sample', lastName: 'Candidate', salary: 99999 }, positionTitle: 'Nurse', stage: 'Interview', updatedAt, compensation: 99999 });
beforeEach(() => getApi.mockReset());
describe('personal application activity', () => {
  it('requests the latest four assigned application updates and projects only display fields', async () => {
    getApi.mockResolvedValue({ data: [row('a1')] });
    const result = await fetchMyWorkActivity('me');
    expect(getApi).toHaveBeenCalledWith('/applications?primaryRecruiterId=me&sortBy=updatedAt&sortDirection=desc&page=1&pageSize=4');
    expect(result).toEqual([{ id: 'a1', name: 'Sample Candidate', job: 'Nurse', stage: 'Interview', updatedAt: '2026-11-02T10:00:00Z' }]);
    expect(JSON.stringify(result)).not.toMatch(/99999|salary|compensation/);
  });
  it('orders by update time, deduplicates, and caps the list', async () => {
    getApi.mockResolvedValue({ data: [row('a1'), row('a2', '2026-11-02T11:00:00Z'), row('a2'), row('a3'), row('a4'), row('a5')] });
    expect((await fetchMyWorkActivity('me')).map(item => item.id)).toEqual(['a2', 'a1', 'a3', 'a4']);
  });
  it('does not display a foreign or unverified application owner', async () => {
    getApi.mockResolvedValue({ data: [{ ...row('foreign'), primaryRecruiterId: 'other' }, { ...row('unknown'), primaryRecruiterId: null }, row('mine')] });
    expect((await fetchMyWorkActivity('me')).map(item => item.id)).toEqual(['mine']);
  });
  it('uses the application code when the server redacts the candidate name', async () => {
    getApi.mockResolvedValue({ data: [{ ...row('a1'), candidate: null }] });
    expect((await fetchMyWorkActivity('me'))[0]?.name).toBe('APP-1');
  });
  it('keeps an empty response distinct from malformed data or an API failure', async () => {
    getApi.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({}).mockResolvedValueOnce({ data: [row('a1', 'bad-date')] }).mockRejectedValueOnce(new Error('Unavailable'));
    expect(await fetchMyWorkActivity('me')).toEqual([]);
    await expect(fetchMyWorkActivity('me')).rejects.toThrow('unavailable');
    await expect(fetchMyWorkActivity('me')).rejects.toThrow('unavailable');
    await expect(fetchMyWorkActivity('me')).rejects.toThrow('Unavailable');
  });
  it('never makes an unscoped request without an employee id', async () => {
    await expect(fetchMyWorkActivity('')).rejects.toThrow('identified');
    expect(getApi).not.toHaveBeenCalled();
  });
});
