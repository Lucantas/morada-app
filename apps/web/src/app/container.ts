import { InMemoryResidentRepository } from '@/features/residents/data/in-memory-resident-repository';

import { residentSeed } from './seed';

export const residentRepository = new InMemoryResidentRepository(residentSeed);
