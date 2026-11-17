import { randomUUID } from 'node:crypto';
import type { AuthUser } from '@recruitflow/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { ResultsService } from '../results.service';

const ORG='10000000-0000-4000-8000-000000000001';
const NOW=new Date('2026-11-02T12:00:00Z');
describe('monthly plans and automatic weekly projection',()=>{
  const ids={manager:randomUUID(),employee:randomUUID(),outsider:randomUUID(),other:randomUUID()};
  const auth=(userId:string,roleCodes:string[]):AuthUser=>({userId,organizationId:ORG,roleCodes,tokenVersion:0});
  const manager=auth(ids.manager,['HIRING_MANAGER']), employee=auth(ids.employee,['RECRUITER']),outsider=auth(ids.outsider,['HIRING_MANAGER']);
  const users=[
    {id:ids.manager,organizationId:ORG,displayName:'Sample Manager',jobTitle:'Manager',status:'Active',managerId:null,userRoles:[{role:{code:'HIRING_MANAGER'}}]},
    {id:ids.employee,organizationId:ORG,displayName:'Sample Employee',jobTitle:'Recruiter',status:'Active',managerId:ids.manager,userRoles:[{role:{code:'RECRUITER'}}]},
    {id:ids.outsider,organizationId:ORG,displayName:'Other Manager',jobTitle:'Manager',status:'Active',managerId:ids.other,userRoles:[{role:{code:'HIRING_MANAGER'}}]},
  ];
  type TargetRow={id:string;organizationId:string;employeeId:string;metric:string;periodType:string;periodKey:string;scopeKey:string;vacancyId:string|null;targetQuantity:number;version:number;isActive:boolean};
  type Revision={id:string;targetId:string;organizationId:string;actorId:string;priorQuantity:number|null;newQuantity:number;reason:string;createdAt:Date};
  type Query={organizationId?:string;id?:string|{in:string[]};employeeId?:string|{in:string[]};managerId?:string;status?:string;metric?:string;periodType?:string;periodKey?:string|{in:string[]};scopeKey?:string;isActive?:boolean;version?:number};
  const mem:{targets:TargetRow[];revisions:Revision[];audits:Record<string,unknown>[];screenings:ReturnType<typeof screening>[]}={targets:[],revisions:[],audits:[],screenings:[]};
  function screening(applicationId:string,extra:{screenedAt?:Date}={}){return {id:randomUUID(),organizationId:ORG,applicationId,screenerId:ids.employee,outcome:'Passed',screenedAt:NOW,application:{id:applicationId,vacancyId:'sample-job',vacancy:{id:'sample-job',branchId:'branch',position:{title:'Sample Job'}}},...extra};}
  const matches=(row:TargetRow,where:Query={})=>Object.entries(where).every(([key,value])=>{
    const actual=row[key as keyof TargetRow];return typeof value==='object'&&value&&'in'in value?value.in.includes(String(actual)):actual===value;
  });
  const prisma={
    user:{findMany:async({where}: {where?:Query}={})=>users.filter(row=>(!where?.organizationId||row.organizationId===where.organizationId)&&(!where?.managerId||row.managerId===where.managerId)&&(!where?.id||(typeof where.id==='string'?row.id===where.id:where.id.in.includes(row.id)))),findFirst:async({where}:{where:Query})=>users.find(row=>row.id===where.id&&row.organizationId===where.organizationId)??null},
    vacancy:{findMany:async()=>[],findFirst:async()=>null},application:{findMany:async()=>[]},task:{findMany:async()=>[]},offerVersion:{findMany:async()=>[]},interview:{findMany:async()=>[]},interviewScorecard:{findMany:async()=>[]},hiringCase:{findMany:async()=>[]},
    screeningLog:{findMany:async({where}:{where?:{notes?:unknown}}={})=>where?.notes?[]:mem.screenings},
    employeeActivityTarget:{
      findMany:async({where}:{where?:Query}={})=>mem.targets.filter(row=>matches(row,where)),
      findFirst:async({where}:{where:Query})=>mem.targets.find(row=>matches(row,where))??null,
      create:async({data}:{data:Omit<TargetRow,'id'>})=>{const row={...data,id:randomUUID()};mem.targets.push(row);return row;},
      updateMany:async({where,data}:{where:Query;data:{targetQuantity:number;version:{increment:number}}})=>{const row=mem.targets.find(item=>matches(item,where));if(!row)return {count:0};row.targetQuantity=data.targetQuantity;row.version+=data.version.increment;return {count:1};},
    },
    employeeActivityTargetRevision:{findMany:async({where}:{where?:{targetId?:{in:string[]}}}={})=>mem.revisions.filter(row=>!where?.targetId||where.targetId.in.includes(row.targetId)),create:async({data}:{data:Omit<Revision,'id'|'createdAt'>})=>{const row={...data,id:randomUUID(),createdAt:NOW};mem.revisions.push(row);return row;}},
    auditLog:{create:async({data}:{data:Record<string,unknown>})=>{mem.audits.push(data);return data;}},
    $transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>{const snapshot=structuredClone({targets:mem.targets,revisions:mem.revisions,audits:mem.audits});try{return await fn(prisma);}catch(error){mem.targets=snapshot.targets;mem.revisions=snapshot.revisions;mem.audits=snapshot.audits;throw error;}},
  };
  const access={getApplicationVisibilityWhere:async()=>({organizationId:ORG}),getVacancyVisibilityWhere:async()=>({organizationId:ORG})};
  const svc=new ResultsService(prisma as never,access as never);
  beforeEach(()=>{mem.targets=[];mem.revisions=[];mem.audits=[];mem.screenings=[];});

  it('saves a four-metric monthly plan in one transaction without creating weekly rows',async()=>{
    const result=await svc.saveMonthlyPlan(manager,{employeeId:ids.employee,month:'2026-11',targets:[
      {metric:'screenings_completed',targetQuantity:30,version:null},{metric:'interviews_conducted',targetQuantity:20,version:null},
      {metric:'feedback_submitted',targetQuantity:12,version:null},{metric:'seats_joined',targetQuantity:2,version:null},
    ]},NOW);
    expect(result.targets).toHaveLength(4);
    expect(mem.targets.every(row=>row.periodType==='monthly')).toBe(true);
    expect(mem.revisions).toHaveLength(4);expect(mem.audits).toHaveLength(4);
    const weekly=await svc.listTargets(employee,{scope:'me',periodType:'weekly',periodKey:'2026-W45'},NOW);
    expect(weekly.targets.find(item=>item.metric==='screenings_completed')).toMatchObject({target:7,source:'monthly',monthlySources:[{month:'2026-11',monthlyQuantity:30,weeklyQuantity:7}]});
    expect(mem.targets).toHaveLength(4);
  });

  it('combines month-boundary shares, counts actual records once, and preserves a legacy weekly fallback',async()=>{
    for(const [periodKey,targetQuantity]of [['2026-10',31],['2026-11',30]] as const)await svc.createTarget(manager,{employeeId:ids.employee,metric:'screenings_completed',periodType:'monthly',periodKey,targetQuantity},NOW);
    await svc.createTarget(manager,{employeeId:ids.employee,metric:'screenings_completed',periodType:'weekly',periodKey:'2026-W44',targetQuantity:99},NOW);
    await svc.createTarget(manager,{employeeId:ids.employee,metric:'interviews_conducted',periodType:'weekly',periodKey:'2026-W44',targetQuantity:4},NOW);
    mem.screenings.push(screening(randomUUID(),{screenedAt:new Date('2026-10-30T10:00:00Z')}));
    const result=await svc.listTargets(employee,{scope:'me',periodType:'weekly',periodKey:'2026-W44'},NOW);
    expect(result.targets.find(item=>item.metric==='screenings_completed')).toMatchObject({target:7,achieved:1,source:'monthly'});
    expect(result.targets.find(item=>item.metric==='screenings_completed')?.monthlySources?.map(source=>source.weeklyQuantity)).toEqual([6,1]);
    expect(result.targets.find(item=>item.metric==='interviews_conducted')).toMatchObject({target:4,source:'legacy-weekly'});
    expect(mem.targets).toHaveLength(4);
    const team=await svc.results(manager,'team',{periodType:'weekly',periodKey:'2026-W44'},NOW);
    expect(team.targets?.find(item=>item.metric==='screenings_completed')).toMatchObject({target:7,source:'monthly'});
  });

  it('rolls back the complete plan on a stale metric and keeps accurate revision history on success',async()=>{
    const first=await svc.saveMonthlyPlan(manager,{employeeId:ids.employee,month:'2026-11',targets:[{metric:'screenings_completed',targetQuantity:20,version:null},{metric:'interviews_conducted',targetQuantity:10,version:null}]},NOW);
    await expect(svc.saveMonthlyPlan(manager,{employeeId:ids.employee,month:'2026-11',reason:'Team coverage',targets:[{metric:'screenings_completed',targetQuantity:30,version:1},{metric:'interviews_conducted',targetQuantity:12,version:99}]},NOW)).rejects.toThrow(/updated/);
    expect(mem.targets.map(row=>row.targetQuantity)).toEqual([20,10]);expect(mem.revisions).toHaveLength(2);
    await svc.saveMonthlyPlan(manager,{employeeId:ids.employee,month:'2026-11',reason:'Team coverage',targets:first.targets.map(item=>({metric:item.metric,targetQuantity:item.target+1,version:item.version}))},NOW);
    expect(mem.revisions.slice(2).map(row=>[row.priorQuantity,row.newQuantity])).toEqual([[20,21],[10,11]]);
    expect(mem.targets.every(row=>row.version===2)).toBe(true);
  });

  it('enforces plan authorization, validation and exact job scope, including a zero allocated week',async()=>{
    const dto={employeeId:ids.employee,month:'2026-11',targets:[{metric:'screenings_completed',targetQuantity:1,version:null}]};
    await expect(svc.saveMonthlyPlan(employee,dto,NOW)).rejects.toMatchObject({status:403});
    await expect(svc.saveMonthlyPlan(outsider,dto,NOW)).rejects.toMatchObject({status:403});
    await expect(svc.saveMonthlyPlan(manager,{...dto,targets:[dto.targets[0]!,dto.targets[0]!] },NOW)).rejects.toMatchObject({status:400});
    await expect(svc.saveMonthlyPlan(manager,{...dto,targets:[{metric:'screenings_completed',targetQuantity:1.5,version:null}]},NOW)).rejects.toMatchObject({status:400});
    await svc.saveMonthlyPlan(manager,dto,NOW);
    const weekly=await svc.listTargets(employee,{scope:'me',periodType:'weekly',periodKey:'2026-W45'},NOW);
    expect(weekly.targets[0]).toMatchObject({target:0,source:'monthly',remaining:0,progressPercent:0});
    const hidden=await svc.listTargets(outsider,{scope:'team',periodType:'weekly',periodKey:'2026-W45'},NOW).catch(error=>error);
    expect(hidden).toMatchObject({status:403});
  });


});
