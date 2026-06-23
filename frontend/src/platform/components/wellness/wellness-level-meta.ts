export const WELLNESS_LEVEL_META: Record<string, { tone: string; traits: string[] }> = {
  "Zen Sloth": {
    tone: "cwp-tone-sloth",
    traits: ["Occasionally appears in yoga class", "Opens wellness emails for later", "Knows breathwork exists"]
  },
  "Calm Panda": {
    tone: "cwp-tone-panda",
    traits: ["Comes when stress becomes critical", "Has a favorite yoga teacher", "Pretends stretching solved all life problems"]
  },
  "Balanced Otter": {
    tone: "cwp-tone-otter",
    traits: ["Regular class attendee", "Talks about magnesium and sleep quality", "Might recommend breathwork to coworkers"]
  },
  "Mindful Wolf": {
    tone: "cwp-tone-wolf",
    traits: ["Protects calendar time for wellness", "Understands mobility vs flexibility", "Drinks water voluntarily"]
  },
  "Elevated Eagle": {
    tone: "cwp-tone-eagle",
    traits: ["Never misses wellness week", "Has favorite meditation track", "Colleagues ask them for stress advice"]
  },
  "Corporate Dragon": {
    tone: "cwp-tone-dragon",
    traits: ["Attends everything", "Breathes through deadlines", "Survives Monday meetings without emotional damage"]
  }
};

export function wellnessLevelMeta(title: string) {
  return WELLNESS_LEVEL_META[title] ?? { tone: "cwp-tone-otter", traits: [] };
}
