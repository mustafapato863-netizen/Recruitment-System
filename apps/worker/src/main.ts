const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

console.log(`RecruitFlow worker ready. Redis target: ${redisUrl.replace(/:.+@/, ':***@')}`);
