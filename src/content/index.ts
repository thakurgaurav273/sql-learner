import type { Lesson } from './types.ts';
import { basics } from './lessons/basics.ts';
import { joins } from './lessons/joins.ts';
import { aggregation } from './lessons/aggregation.ts';
import { modify } from './lessons/modify.ts';
import { performance } from './lessons/performance.ts';

export const lessons: Lesson[] = [...basics, ...joins, ...aggregation, ...modify, ...performance];
