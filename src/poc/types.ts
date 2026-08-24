/**
 * Digital Twin V2 Specification Types (PoC)
 * Ref: docs/DIGITAL_TWIN_SPEC.md
 */

export type SlotType = 'TEXT' | 'IMAGE' | 'COLOR' | 'VISIBLE';

export type SlotRole = 
  | 'HEADLINE' 
  | 'SUBTITLE' 
  | 'BODY' 
  | 'CTA' 
  | 'HERO_IMAGE' 
  | 'LOGO' 
  | 'BACKGROUND' 
  | 'CUSTOM';

export interface TextConstraints {
  maxCharacters?: number;
  maxLines?: number;
  textAutoResize?: 'NONE' | 'HEIGHT' | 'WIDTH_AND_HEIGHT' | 'TRUNCATE';
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
}

export interface ImageConstraints {
  width: number;
  height: number;
  aspectRatio: number;
}

export interface SlotSpec {
  slotId: string;           // Immutable Slot ID (e.g. "headline")
  nodeId: string;           // Native Figma Node ID (e.g. "12:345")
  nodeName: string;         // Layer name in Figma (e.g. "#slot:headline")
  type: SlotType;
  role: SlotRole;
  textConstraints?: TextConstraints;
  imageConstraints?: ImageConstraints;
  defaultValue?: string;    // Current text or fill URL on Figma canvas
}

export interface DigitalTwinSpec {
  version: '2.0.0';
  templateId: string;
  templateName: string;
  dimensions: {
    width: number;
    height: number;
  };
  slots: SlotSpec[];
  metadata?: Record<string, unknown>;
}

export interface SlotValuesDto {
  templateId: string;
  slotValues: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface RoundTripValidationResult {
  isInvariant: boolean;
  mismatches: string[];
  twin1: DigitalTwinSpec;
  twin2: DigitalTwinSpec;
}
