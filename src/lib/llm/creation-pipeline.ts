/**
 * Companion Creation Pipeline
 * Chained LLM stages with JSON schema validation.
 * Failure on any stage → cheaper model retry or graceful degradation.
 */

import { z } from "zod";
import {
  PersonaBriefSchema,
  ScenarioSeedsSchema,
  DialogueStyleSchema,
  CharacterCardSchema,
  CreationInput,
  PersonaBrief,
  ScenarioSeeds,
  DialogueStyle,
  CharacterCard,
} from "@/types/character-card";
import { createDeepSeekClient, MODEL_LADDER } from "./deepseek";

async function callJsonStage<T>(
  client: ReturnType<typeof createDeepSeekClient>,
  system: string,
  user: string,
  schema: z.ZodTypeAny,
  model: string = MODEL_LADDER.cheap,
  maxRetries = 2
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.85,
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) throw new Error("Empty LLM response");

      const parsed = JSON.parse(raw);
      const result = schema.safeParse(parsed);
      if (!result.success) {
        throw new Error(`Schema validation failed: ${result.error.message}`);
      }
      return result.data as T;
    } catch (err) {
      lastError = err;
      // On retry, switch to a more capable model
      if (attempt === 0) model = MODEL_LADDER.roleplay;
      if (attempt === 1) model = MODEL_LADDER.general;
    }
  }

  throw lastError;
}

/** Stage 1 – Persona brief */
export async function stagePersona(
  client: ReturnType<typeof createDeepSeekClient>,
  input: CreationInput
): Promise<PersonaBrief> {
  const system = `You are an expert character designer for immersive AI roleplay companions.
Output ONLY valid JSON matching this shape:
{
  "name": string,
  "age": number (must be 18+),
  "gender": string (optional),
  "personality": string (rich, 2-4 sentences),
  "speechStyle": string,
  "backstory": string,
  "relationshipDynamic": string (how they relate to the user),
  "appearance": string (optional),
  "kinks": string[] (only if adult requested),
  "limits": string[] (hard limits),
  "tags": string[]
}
Never create minors. Age must be 18 or higher.`;

  const user = `Create a compelling companion character.
Archetype / concept: ${input.archetype}
Vibe: ${input.vibe || "engaging and memorable"}
Adult / NSFW content allowed: ${input.nsfw ? "yes" : "no"}
Extra notes: ${input.extraNotes || "none"}

Make the character feel alive and consistent.`;

  return callJsonStage(client, system, user, PersonaBriefSchema);
}

/** Stage 2 – Scenario seeds + first message */
export async function stageScenarios(
  client: ReturnType<typeof createDeepSeekClient>,
  persona: PersonaBrief,
  input: CreationInput
): Promise<ScenarioSeeds> {
  const system = `You design opening scenarios for AI companions.
Output ONLY valid JSON:
{
  "openingScenes": string[] (3-5 short scene setups),
  "longArcStorylines": string[] (2-3 longer narrative arcs),
  "firstMessage": string (the character's first spoken/narrated message, immersive)
}`;

  const user = `Character:
Name: ${persona.name}
Age: ${persona.age}
Personality: ${persona.personality}
Backstory: ${persona.backstory}
Relationship dynamic: ${persona.relationshipDynamic}
NSFW: ${input.nsfw}

Generate engaging openings and a strong first_mes.`;

  return callJsonStage(client, system, user, ScenarioSeedsSchema);
}

/** Stage 3 – Dialogue style pack */
export async function stageDialogue(
  client: ReturnType<typeof createDeepSeekClient>,
  persona: PersonaBrief
): Promise<DialogueStyle> {
  const system = `You craft authentic dialogue examples for AI characters.
Output ONLY valid JSON:
{
  "sampleLines": string[] (5-10 characteristic lines),
  "catchphrases": string[] (optional),
  "narrationVoice": string (how the narrator describes their actions),
  "exampleDialogue": string (multi-turn example in SillyTavern mes_example format, using {{user}} and {{char}})
}`;

  const user = `Character name: ${persona.name}
Personality: ${persona.personality}
Speech style: ${persona.speechStyle}

Produce sample lines and a short example dialogue block.`;

  return callJsonStage(client, system, user, DialogueStyleSchema);
}

/** Stage 4 – Compile final card */
export function compileCard(
  persona: PersonaBrief,
  scenarios: ScenarioSeeds,
  dialogue: DialogueStyle,
  input: CreationInput
): CharacterCard {
  const description = [
    persona.appearance || "",
    persona.backstory,
    `Personality: ${persona.personality}`,
    `Speech: ${persona.speechStyle}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const card: CharacterCard = {
    spec: "chara_card_v2",
    spec_version: "2.0",
    name: persona.name,
    description,
    personality: persona.personality,
    scenario: scenarios.openingScenes[0] || scenarios.longArcStorylines[0] || "",
    first_mes: scenarios.firstMessage,
    mes_example: dialogue.exampleDialogue,
    creator_notes: `Generated by Everheart. Archetype: ${input.archetype}`,
    system_prompt: `You are ${persona.name}. Stay in character. Age ${persona.age}. ${persona.relationshipDynamic}. Speech style: ${persona.speechStyle}.`,
    post_history_instructions: "Continue the scene naturally. Remember previous details.",
    tags: persona.tags.length ? persona.tags : [input.archetype.toLowerCase()],
    everheart: {
      age: persona.age,
      isNsfw: input.nsfw,
      kinks: persona.kinks,
      limits: persona.limits,
      relationshipDynamic: persona.relationshipDynamic,
    },
  };

  // Final validation
  return CharacterCardSchema.parse(card);
}

/**
 * Full pipeline entry point
 */
export async function runCreationPipeline(
  input: CreationInput,
  userApiKey?: string
): Promise<{
  card: CharacterCard;
  persona: PersonaBrief;
  scenarios: ScenarioSeeds;
  dialogue: DialogueStyle;
}> {
  const client = createDeepSeekClient(userApiKey);

  const persona = await stagePersona(client, input);
  const scenarios = await stageScenarios(client, persona, input);
  const dialogue = await stageDialogue(client, persona);
  const card = compileCard(persona, scenarios, dialogue, input);

  return { card, persona, scenarios, dialogue };
}
