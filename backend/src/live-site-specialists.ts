/** Specialist bios & photos from https://dharma-space.com (published bundle). */
const LIVE_COMPONENT_BASE =
  "https://dharma-space.com/_components/v2/2fb642c1e1e8a3d489b305d25dad7a2dafa9257a";

export const LIVE_SITE_TRAINERS = [
  {
    name: "Vera Pleshakova",
    role: "Founder & Lead Facilitator",
    description:
      "14 years of yoga teaching experience. Integrating ancient wisdom with modern science in Yoga and Mindfulness",
    credentials: "E-RYT 500 · YACEP · Sound Healer",
    imageUrl: `${LIVE_COMPONENT_BASE}/photo-366-1.af4e845a.jpg`,
    sortOrder: 0
  },
  {
    name: "Bolor Lorinet",
    role: "Psychotherapist & Wellbeing Coach",
    description: "Bridging therapy and coaching for deep personal and professional transformation",
    credentials: "Master of Counselling · Monash University · ICF Coach",
    imageUrl: `${LIVE_COMPONENT_BASE}/5e57a1df-c711-48ba-a5f1-5fb22bd61851.8f8f7df3.JPG`,
    sortOrder: 1
  },
  {
    name: "Kristina Gazi",
    role: "Leadership & Mindfulness Coach",
    description: "Guiding leaders in sustainable high performance",
    credentials: "ICF Coach · Neuroencoding Specialist · Business Mentor",
    imageUrl: `${LIVE_COMPONENT_BASE}/IMG_7704.f4fb1cff.JPG`,
    sortOrder: 2
  },
  {
    name: "Oxana Shilina",
    role: "Breathwork Facilitator",
    description: "Transformational breathwork for stress release and reconnection with yourself",
    credentials: '"Alchemy of Breath" Certification',
    imageUrl: `${LIVE_COMPONENT_BASE}/Screenshot_2026-05-26_at_21.25.32.f50224b7.png`,
    sortOrder: 3
  },
  {
    name: "Yana An",
    role: "Handpan Teacher & Art Therapist",
    description:
      "Guiding students into the meditative world of handpan — from first touch to expressive play — while weaving art therapy for deep emotional healing.",
    credentials: "Sound Healer",
    imageUrl: `${LIVE_COMPONENT_BASE}/IMG_7720_2.506eacb6.JPG`,
    sortOrder: 4
  },
  {
    name: "Kanthan Jeganathan",
    role: "Human Behavior & Trauma Specialist",
    description:
      "Helping organizations navigate complex behavioral challenges, trauma, and life transitions with clarity, structure, and practical support.",
    credentials: "E-RYT 500 · YACEP · B.Sc. Physio",
    imageUrl: `${LIVE_COMPONENT_BASE}/IMG_7727.ce7e9b6d.JPG`,
    sortOrder: 5
  },
  {
    name: "Dr. Nirmal Bhusal",
    role: "Nutrition Coach",
    description: "Ayurvedic nutrition meets functional medicine approach",
    credentials: "BAMS · MD Ayurveda · PhD",
    imageUrl: `${LIVE_COMPONENT_BASE}/IMG_7703.71ed5710.JPG`,
    sortOrder: 6
  },
  {
    name: "Manjeet Mathur",
    role: "Yoga Philosophy Teacher & Meditation Guide",
    description:
      "Bringing the depth of classical yoga philosophy and meditation into modern life — making ancient teachings accessible, transformative, and deeply relevant.",
    credentials: "MTTC · RYT 500",
    imageUrl: `${LIVE_COMPONENT_BASE}/IMG_7730.342fea81.jpg`,
    sortOrder: 7
  }
] as const;

export async function syncTrainersFromLiveSite(prisma: import("@prisma/client").PrismaClient) {
  for (const live of LIVE_SITE_TRAINERS) {
    const existing = await prisma.siteTrainer.findFirst({ where: { name: live.name } });
    if (existing) {
      const keepStoredPhoto =
        existing.imageUrl.includes("/api/media/trainers/") ||
        (existing.imageUrl.startsWith("/specialists/") && !existing.imageUrl.includes("_components/"));

      await prisma.siteTrainer.update({
        where: { id: existing.id },
        data: {
          role: live.role,
          description: live.description,
          credentials: live.credentials,
          ...(keepStoredPhoto ? {} : { imageUrl: live.imageUrl }),
          sortOrder: live.sortOrder
        }
      });
    }
  }
}
