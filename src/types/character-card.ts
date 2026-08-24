import { z } from "zod";

/**
 * SillyTavern / Chub compatible character card (V2 / V3 core fields)
 * We store the full JSON and also keep a typed view for the pipeline.
 */

export const PersonaBriefSchema = z.object({
  name: z.string().min(1).max(80),
  age: z.number().int().min(18).max(120), // hard 18+ for adult-optional product
  gender: z.string().optional(),
  personality: z.string().min(20),
  speechStyle: z.string().min(10),
  backstory: z.string().min(30),
  relationshipDynamic: z.string().min(10),
  appearance: z.string().optional(),
  kinks: z.array(z.string()).optional(),
  limits: z.array(z.string()).optional(),
  tags: z.array(z.string()).default([]),
});

export type PersonaBrief = z.infer<typeof PersonaBriefSchema>;

export const ScenarioSeedsSchema = z.object({
  openingScenes: z.array(z.string()).min(1).max(5),
  longArcStorylines: z.array(z.string()).min(1).max(3),
  firstMessage: z.string().min(20),
});

export type ScenarioSeeds = z.infer<typeof ScenarioSeedsSchema>;

export const DialogueStyleSchema = z.object({
  sampleLines: z.array(z.string()).min(3).max(12),
  catchphrases: z.array(z.string()).max(6).optional(),
  narrationVoice: z.string().min(10),
  exampleDialogue: z.string().min(50), // mes_example format
});

export type DialogueStyle = z.infer<typeof DialogueStyleSchema>;

/** Final card shape we compile into (compatible with ST V2/V3) */
export const CharacterCardSchema = z.object({
  spec: z.literal("chara_card_v2").or(z.literal("chara_card_v3")).default("chara_card_v2"),
  spec_version: z.string().default("2.0"),
  name: z.string(),
  description: z.string(),
  personality: z.string(),
  scenario: z.string(),
  first_mes: z.string(),
  mes_example: z.string(),
  creator_notes: z.string().optional(),
  system_prompt: z.string().optional(),
  post_history_instructions: z.string().optional(),
  tags: z.array(z.string()).default([]),
  // Extra fields we keep for our app
  everheart: z
    .object({
      age: z.number(),
      isNsfw: z.boolean(),
      kinks: z.array(z.string()).optional(),
      limits: z.array(z.string()).optional(),
      relationshipDynamic: z.string().optional(),
    })
    .optional(),
});

export type CharacterCard = z.infer<typeof CharacterCardSchema>;

export const CreationInputSchema = z.object({
  archetype: z.string().min(2).max(100),
  vibe: z.string().max(200).optional(),
  nsfw: z.boolean().default(false),
  extraNotes: z.string().max(500).optional(),
});

export type CreationInput = z.infer<typeof CreationInputSchema>;
