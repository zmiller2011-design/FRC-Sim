import type { FieldConfig, FieldElement } from '@/field/types';

export type ElementOf<T extends FieldElement['type']> = Extract<FieldElement, { type: T }>;
export type { FieldConfig };

/** Inches to metres, for small cosmetic sizes that are not part of the official dimensions. */
export const IN = 0.0254;
