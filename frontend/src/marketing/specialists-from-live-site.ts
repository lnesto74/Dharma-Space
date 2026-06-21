/**
 * Specialist profiles synced from https://dharma-space.com (published Figma Make bundle).
 * Source: /_components/v2/2fb642c1e1e8a3d489b305d25dad7a2dafa9257a.js
 */
const LIVE_COMPONENT_BASE =
  "https://dharma-space.com/_components/v2/2fb642c1e1e8a3d489b305d25dad7a2dafa9257a";

export type LiveSpecialist = {
  name: string;
  role: string;
  desc: string;
  cert: string;
  img: string;
  /** Vera's portrait uses object-[center_15%] scale-125 on the live site */
  portraitFocus?: boolean;
};

export const LIVE_SITE_SPECIALISTS: LiveSpecialist[] = [
  {
    name: "Vera Pleshakova",
    role: "Founder & Lead Facilitator",
    desc: "14 years of yoga teaching experience. Integrating ancient wisdom with modern science in Yoga and Mindfulness",
    cert: "E-RYT 500 · YACEP · Sound Healer",
    img: `${LIVE_COMPONENT_BASE}/photo-366-1.af4e845a.jpg`,
    portraitFocus: true
  },
  {
    name: "Bolor Lorinet",
    role: "Psychotherapist & Wellbeing Coach",
    desc: "Bridging therapy and coaching for deep personal and professional transformation",
    cert: "Master of Counselling · Monash University · ICF Coach",
    img: `${LIVE_COMPONENT_BASE}/5e57a1df-c711-48ba-a5f1-5fb22bd61851.8f8f7df3.JPG`
  },
  {
    name: "Kristina Gazi",
    role: "Leadership & Mindfulness Coach",
    desc: "Guiding leaders in sustainable high performance",
    cert: "ICF Coach · Neuroencoding Specialist · Business Mentor",
    img: `${LIVE_COMPONENT_BASE}/IMG_7704.f4fb1cff.JPG`
  },
  {
    name: "Oxana Shilina",
    role: "Breathwork Facilitator",
    desc: "Transformational breathwork for stress release and reconnection with yourself",
    cert: '"Alchemy of Breath" Certification',
    img: `${LIVE_COMPONENT_BASE}/Screenshot_2026-05-26_at_21.25.32.f50224b7.png`
  },
  {
    name: "Yana An",
    role: "Handpan Teacher & Art Therapist",
    desc: "Guiding students into the meditative world of handpan — from first touch to expressive play — while weaving art therapy for deep emotional healing.",
    cert: "Sound Healer",
    img: `${LIVE_COMPONENT_BASE}/IMG_7720_2.506eacb6.JPG`
  },
  {
    name: "Kanthan Jeganathan",
    role: "Human Behavior & Trauma Specialist",
    desc: "Helping organizations navigate complex behavioral challenges, trauma, and life transitions with clarity, structure, and practical support.",
    cert: "E-RYT 500 · YACEP · B.Sc. Physio",
    img: `${LIVE_COMPONENT_BASE}/IMG_7727.ce7e9b6d.JPG`
  },
  {
    name: "Dr. Nirmal Bhusal",
    role: "Nutrition Coach",
    desc: "Ayurvedic nutrition meets functional medicine approach",
    cert: "BAMS · MD Ayurveda · PhD",
    img: `${LIVE_COMPONENT_BASE}/IMG_7703.71ed5710.JPG`
  },
  {
    name: "Manjeet Mathur",
    role: "Yoga Philosophy Teacher & Meditation Guide",
    desc: "Bringing the depth of classical yoga philosophy and meditation into modern life — making ancient teachings accessible, transformative, and deeply relevant.",
    cert: "MTTC · RYT 500",
    img: `${LIVE_COMPONENT_BASE}/IMG_7730.342fea81.jpg`
  }
];

export const LIVE_SPECIALIST_BY_NAME = Object.fromEntries(
  LIVE_SITE_SPECIALISTS.map((s) => [s.name, s])
) as Record<string, LiveSpecialist>;
