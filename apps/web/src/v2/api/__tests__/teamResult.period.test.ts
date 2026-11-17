import { beforeEach, describe, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({getApi:vi.fn()}));
vi.mock('../../../api/client',()=>api);
import { fetchTeamResult } from '../teamResult';
const tile={value:0,of:0,sampleSize:0,detail:'',tooFewToJudge:true};
const response=()=>({scope:'team',month:'2026-11',range:{from:'2026-11-01',to:'2026-11-30'},people:[],tiles:{seats:tile,offersAccepted:tile,screensReachedInterview:tile,overdueFollowUps:tile}});
beforeEach(()=>vi.clearAllMocks());
describe('period analytics adapter',()=>{
  it('refuses an old server response that silently ignores the weekly period',async()=>{
    api.getApi.mockResolvedValue(response());
    expect(await fetchTeamResult('2026-11','job','branch',{type:'weekly',key:'2026-W45'})).toEqual({kind:'unavailable'});
    expect(api.getApi).toHaveBeenCalledWith('/results/team?periodType=weekly&periodKey=2026-W45&vacancyId=job&branchId=branch');
  });
  it('accepts the exact requested weekly period and rejects malformed work counts',async()=>{
    api.getApi.mockResolvedValue({...response(),periodType:'weekly',periodKey:'2026-W45',rows:[{person:{id:'one',name:'One'},tiles:response().tiles,workCounts:{screenings_completed:-2}}]});
    const result=await fetchTeamResult('2026-11',null,null,{type:'weekly',key:'2026-W45'});
    expect(result.kind).toBe('ready');
    if(result.kind==='ready')expect(result.data.rows[0]?.workCounts).toBeUndefined();
  });
});
