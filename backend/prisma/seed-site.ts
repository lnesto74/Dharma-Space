import { PrismaClient } from "@prisma/client";
import { dayToIndex, formatMinutesToTime, migrateClassScheduleFields, parseTimeToMinutes, snapMinutes } from "../src/class-schedule.js";
import { migrateProgramCategories } from "../src/site-content.js";
import { LIVE_SITE_TRAINERS, syncTrainersFromLiveSite } from "../src/live-site-specialists.js";
import { importBundledSiteMedia } from "../src/import-site-media.js";

const FLAGSHIP_CURRICULUM = [
  "Yoga Philosophy & History",
  "Anatomy & Physiology",
  "Teaching Methodology",
  "Alignment & Adjustments",
  "Breathwork (Pranayama)",
  "Meditation Techniques",
  "Practicum Teaching Hours",
  "Ayurvedic Lifestyle"
];

export async function seedSiteContent(prisma: PrismaClient) {
  const existing = await prisma.siteTrainer.count();
  if (existing > 0) return;

  const trainers = LIVE_SITE_TRAINERS.map((t) => ({
    name: t.name,
    role: t.role,
    description: t.description,
    credentials: t.credentials,
    imageUrl: t.imageUrl,
    sortOrder: t.sortOrder
  }));

  const classes = [
    { day: "Monday", time: "7:00 AM", classType: "Hatha Yoga", instructor: "Priya Sharma", level: "All Levels", location: "Studio A", sortOrder: 0 },
    { day: "Monday", time: "6:30 PM", classType: "Vinyasa Flow", instructor: "Sarah Chen", level: "Intermediate", location: "Studio A", sortOrder: 1 },
    { day: "Tuesday", time: "7:30 AM", classType: "Meditation", instructor: "Ryan Ng", level: "All Levels", location: "Studio B", sortOrder: 2 },
    { day: "Wednesday", time: "7:00 AM", classType: "Power Core Yoga", instructor: "Priya Sharma", level: "Intermediate", location: "Studio A", sortOrder: 3 },
    { day: "Wednesday", time: "7:00 PM", classType: "Yin Yoga", instructor: "Sarah Chen", level: "All Levels", location: "Studio A", sortOrder: 4 },
    { day: "Thursday", time: "6:30 PM", classType: "Aerial Yoga", instructor: "Priya Sharma", level: "Beginner–Int.", location: "Aerial Room", sortOrder: 5 },
    { day: "Friday", time: "7:00 AM", classType: "Hatha Yoga", instructor: "Sarah Chen", level: "All Levels", location: "Studio A", sortOrder: 6 },
    { day: "Saturday", time: "9:00 AM", classType: "Vinyasa Flow", instructor: "Priya Sharma", level: "All Levels", location: "Studio A", sortOrder: 7 },
    { day: "Saturday", time: "11:00 AM", classType: "Breathwork", instructor: "David Lim", level: "All Levels", location: "Studio B", sortOrder: 8 },
    { day: "Sunday", time: "9:00 AM", classType: "Yin & Meditation", instructor: "Ryan Ng", level: "All Levels", location: "Studio A", sortOrder: 9 }
  ];

  const programs = [
    {
      category: "FLAGSHIP",
      title: "200-Hour Yoga Teacher Training",
      description: "Our signature 200-hour Yoga Alliance certified teacher training is a comprehensive, immersive journey that prepares you to teach confidently, live purposefully, and lead with wisdom. Whether you aspire to teach professionally or deepen your own practice, this training will change your life.",
      dates: "Sep 11 – Oct 6, 2026",
      duration: "8 Weeks",
      time: "Thu 7–9PM (Online) · Fri 6:30–9:30PM · Sat & Sun 2–9PM",
      location: "Dharma Space Studio",
      facilitator: "Sarah Chen",
      price: "SGD 3,600",
      certificationLabel: "Yoga Alliance RYT-200",
      classSize: "Maximum 25 Students",
      curriculumItems: JSON.stringify(FLAGSHIP_CURRICULUM),
      badgeTitle: "RYT 200",
      badgeSubtitle: "Yoga Alliance Certified",
      usePayNow: true,
      code: "200TTC",
      depositAmount: "SGD 1,200",
      singlePerson: true,
      sortOrder: 0
    },
    { category: "CERTIFICATION", title: "YACEP 30h Aerial Yoga Teacher Training", description: "Discover the art of suspension yoga with rigging, sequencing, and safety certification.", dates: "Coming Soon", price: "SGD 1,150", singlePerson: true, sortOrder: 1 },
    { category: "CERTIFICATION", title: "Breathwork Facilitator Training", description: "Certified facilitator training in somatic and trauma informed breathwork techniques.", dates: "Coming Soon", price: "SGD 1,500", singlePerson: true, sortOrder: 2 },
    { category: "CERTIFICATION", title: "Meditation Teacher Training", description: "100-hour MTT certification covering mindfulness, breathwork, and non-dual approaches.", dates: "Coming Soon", price: "SGD 2,200", singlePerson: true, sortOrder: 3 },
    { category: "CERTIFICATION", title: "Sound Healing Certification", description: "Tibetan bowls, crystal bowls, and vibrational body contact therapy practitioner certification.", dates: "Coming Soon", price: "SGD 1,800", singlePerson: true, sortOrder: 4 },
    { category: "CERTIFICATION", title: "Barre Instructor Certification", description: "Contemporary barre methodology blending ballet, pilates, and strength training.", dates: "Coming Soon", price: "SGD 1,750", singlePerson: true, sortOrder: 5 },
    {
      category: "WORKSHOP",
      title: "Arm Balance Intensive",
      description: "Build strength and confidence in arm balances with progressive drills and spotting.",
      dates: "September 17, 2026",
      scheduledDate: "2026-09-17",
      time: "2:00 PM",
      price: "SGD 5",
      location: "Dharma Space Studio",
      facilitator: "Vera Pleshakova",
      comingSoon: false,
      usePayNow: false,
      depositAmount: "SGD 5",
      singlePerson: true,
      sortOrder: 10
    },
    { category: "WORKSHOP", title: "Yin & Sound Bath", description: "", dates: "Coming Soon", price: "SGD 75", location: "Dharma Space Studio", singlePerson: true, sortOrder: 11 },
    { category: "WORKSHOP", title: "Breathwork Journey", description: "", dates: "Coming Soon", price: "SGD 85", location: "Dharma Space Studio", singlePerson: true, sortOrder: 12 },
    {
      category: "WORKSHOP",
      title: "Yoga Alignments Workshop",
      description: "Refine your asana with clear alignment cues, hands-on adjustments, and mindful movement patterns.",
      dates: "September 24, 2026",
      scheduledDate: "2026-09-24",
      time: "2:00 PM",
      price: "SGD 5",
      location: "Dharma Space Studio",
      facilitator: "Vera Pleshakova",
      comingSoon: false,
      usePayNow: false,
      depositAmount: "SGD 5",
      singlePerson: true,
      sortOrder: 13
    },
    { category: "EVENT", title: "Cacao Ceremony", description: "A sacred circle of heart-opening cacao, breath, movement, and intention setting for the new season.", dates: "Coming Soon", location: "Dharma Space Studio", facilitator: "Sarah Chen", price: "SGD 88", sortOrder: 20 },
    { category: "EVENT", title: "Ecstatic Dance", description: "Free-form conscious dance journey — no steps, just pure movement and authentic expression.", dates: "Coming Soon", location: "Junction Studios, Singapore", facilitator: "Community DJ Collective", price: "SGD 35", sortOrder: 21 },
    { category: "EVENT", title: "Sound Healing Journey", description: "Deep vibrational healing with Tibetan and crystal bowls, gongs, and guided relaxation.", dates: "Coming Soon", location: "Dharma Space Studio", facilitator: "Yana An", price: "SGD 75", sortOrder: 22 },
    { category: "EVENT", title: "Breathwork Circle", description: "Transformational connected breathwork for emotional release, clarity, and nervous system reset.", dates: "Coming Soon", location: "Dharma Space Studio", facilitator: "Oxana Shilina", price: "SGD 85", sortOrder: 23 },
    { category: "EVENT", title: "Full Moon Ceremony", description: "Outdoor full moon ritual with meditation, singing, sharing circles, and intention weaving.", dates: "Coming Soon", location: "Labrador Nature Reserve", facilitator: "Vera Pleshakova", price: "SGD 55", sortOrder: 24 },
    { category: "EVENT", title: "Glow Yoga", description: "Yoga in a UV-lit studio with neon body paint — under the lamps, every move glows. A playful, high-energy night you won't forget.", dates: "Coming Soon", location: "Dharma Space Studio", facilitator: "Dharma Space Team", price: "SGD 45", sortOrder: 25 }
  ];

  await prisma.siteTrainer.createMany({ data: trainers });
  await prisma.siteClass.createMany({
    data: classes.map((c) => {
      const startMinutes = snapMinutes(parseTimeToMinutes(c.time) ?? 420);
      return {
        ...c,
        dayIndex: dayToIndex(c.day),
        startMinutes,
        durationMinutes: 60,
        time: formatMinutesToTime(startMinutes),
        comingSoon: true,
        stripeLink: null
      };
    })
  });
  await prisma.siteProgram.createMany({ data: programs });
}

async function upgradeFlagshipProgram(prisma: PrismaClient) {
  const flagship = await prisma.siteProgram.findFirst({
    where: { OR: [{ category: "FLAGSHIP" }, { category: "YTT" }], title: { contains: "200-Hour" } }
  });
  if (!flagship) return;

  await prisma.siteProgram.update({
    where: { id: flagship.id },
    data: {
      category: "FLAGSHIP",
      duration: flagship.duration || "8 Weeks",
      certificationLabel: flagship.certificationLabel || "Yoga Alliance RYT-200",
      classSize: flagship.classSize || "Maximum 25 Students",
      badgeTitle: flagship.badgeTitle || "RYT 200",
      badgeSubtitle: flagship.badgeSubtitle || "Yoga Alliance Certified",
      curriculumItems: flagship.curriculumItems && flagship.curriculumItems !== "[]"
        ? flagship.curriculumItems
        : JSON.stringify(FLAGSHIP_CURRICULUM),
      description: flagship.description || "Our signature 200-hour Yoga Alliance certified teacher training is a comprehensive, immersive journey that prepares you to teach confidently, live purposefully, and lead with wisdom."
    }
  });
}

/** Test workshop: bookable at SGD 5 via PayNow (no Stripe link required). */
async function upgradeArmBalanceTestWorkshop(prisma: PrismaClient) {
  const workshop = await prisma.siteProgram.findFirst({
    where: { title: { contains: "Arm Balance" } }
  });
  if (!workshop) return;

  await prisma.siteProgram.update({
    where: { id: workshop.id },
    data: {
      comingSoon: false,
      scheduledDate: "2026-09-17",
      dates: "September 17, 2026",
      time: "2:00 PM",
      facilitator: "Vera Pleshakova",
      price: "SGD 5",
      usePayNow: false,
      depositAmount: "SGD 5",
      stripeLink: null
    }
  });
}

/** Live-payment test workshop: SGD 5 via Stripe Checkout. */
async function upgradeYogaAlignmentsTestWorkshop(prisma: PrismaClient) {
  const workshop = await prisma.siteProgram.findFirst({
    where: {
      OR: [
        { title: { contains: "Meditation Intensive" } },
        { title: { contains: "Yoga Alignments" } }
      ]
    }
  });
  if (!workshop) return;

  await prisma.siteProgram.update({
    where: { id: workshop.id },
    data: {
      title: "Yoga Alignments Workshop",
      description:
        "Refine your asana with clear alignment cues, hands-on adjustments, and mindful movement patterns.",
      comingSoon: false,
      scheduledDate: "2026-09-24",
      dates: "September 24, 2026",
      time: "2:00 PM",
      facilitator: "Vera Pleshakova",
      price: "SGD 5",
      usePayNow: false,
      depositAmount: "SGD 5",
      stripeLink: null,
      location: workshop.location || "Dharma Space Studio"
    }
  });
}

export async function ensureSiteContent(prisma: PrismaClient) {
  await seedSiteContent(prisma);
  await syncTrainersFromLiveSite(prisma);
  await importBundledSiteMedia(prisma).catch((error) => console.error("[startup] site media:", error));
  await migrateProgramCategories(prisma);
  await migrateClassScheduleFields(prisma);
  await upgradeFlagshipProgram(prisma);
  await upgradeArmBalanceTestWorkshop(prisma);
  await upgradeYogaAlignmentsTestWorkshop(prisma);
}
