import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const images = [
  "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80"
];

const courses = [
  ["Burnout Prevention & Stress Recovery", "Stress Recovery", "A calm executive pathway for identifying load, restoring capacity, and building sustainable work rhythms.", "Practitioner", "6 weeks", "HYBRID", 499, true],
  ["Breathwork for High-Performance Teams", "Breathwork", "Practical breath protocols for meeting recovery, focus, and nervous system regulation.", "Beginner", "4 weeks", "ONLINE", 299, true],
  ["Corporate Yoga for Desk-Based Workers", "Yoga", "Mobility, posture, and recovery practices designed for modern knowledge teams.", "Beginner", "3 weeks", "ONSITE", 199, false],
  ["Nutrition for Energy and Focus", "Nutrition", "Evidence-informed habits for stable energy, cognitive clarity, and recovery.", "Beginner", "4 weeks", "ONLINE", 249, false],
  ["Emotional Intelligence for Managers", "Emotional Intelligence", "A manager curriculum for empathy, feedback, repair, and psychological safety.", "Advanced", "8 weeks", "HYBRID", 799, true],
  ["Mental Health First Aid for Teams", "Mental Health First Aid", "Recognize distress signals, respond ethically, and route support with confidence.", "Practitioner", "5 weeks", "ONLINE", 599, true],
  ["Sound Healing Practitioner Foundation", "Sound Healing", "A professional introduction to sound-led relaxation and facilitated recovery sessions.", "Beginner", "6 weeks", "ONSITE", 699, true],
  ["Somatic Intelligence for Leaders", "Somatic Practices", "Embodied awareness tools for decision quality, conflict, and resilient presence.", "Advanced", "6 weeks", "HYBRID", 899, true],
  ["Mindful Leadership Certification", "Leadership Wellbeing", "A certification path for leading with attention, clarity, and humane performance.", "Advanced", "10 weeks", "HYBRID", 1199, true],
  ["Sleep Recovery and Nervous System Reset", "Sleep & Recovery", "Restore sleep architecture with calm routines, recovery rituals, and habit design.", "Beginner", "4 weeks", "ONLINE", 349, false],
  ["Workplace Resilience Facilitator", "Coaching", "Train internal champions to facilitate resilience circles and team recovery rituals.", "Facilitator", "8 weeks", "HYBRID", 999, true],
  ["Dharma Space Coach Certification", "Coaching", "A premium coaching certification for the human skills needed in the AI era.", "Certified Professional", "12 weeks", "HYBRID", 1499, true]
];

async function main() {
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.wellnessAttendance.deleteMany();
  await prisma.wellnessBooking.deleteMany();
  await prisma.wellnessEvent.deleteMany();
  await prisma.scheduleRequest.deleteMany();
  await prisma.wellnessEventCategory.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.session.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.challengeParticipation.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.wellbeingCheckin.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.module.deleteMany();
  await prisma.course.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.company.deleteMany();

  const hash = await bcrypt.hash("password123", 12);
  const companies = await Promise.all([
    prisma.company.create({ data: { name: "Asteria Group", industry: "Technology", plan: "Enterprise", seats: 500 } }),
    prisma.company.create({ data: { name: "Northstar Health", industry: "Healthcare", plan: "Scale", seats: 300 } }),
    prisma.company.create({ data: { name: "Meridian Finance", industry: "Financial Services", plan: "Enterprise", seats: 800 } }),
    prisma.company.create({ data: { name: "Koru Manufacturing", industry: "Manufacturing", plan: "Scale", seats: 420 } }),
    prisma.company.create({ data: { name: "Solace Hotels", industry: "Hospitality", plan: "Pilot", seats: 120 } })
  ]);

  const departments = await Promise.all([
    prisma.department.create({ data: { name: "People & Culture", companyId: companies[0].id } }),
    prisma.department.create({ data: { name: "Product", companyId: companies[0].id } }),
    prisma.department.create({ data: { name: "Sales", companyId: companies[0].id } }),
    prisma.department.create({ data: { name: "Operations", companyId: companies[1].id } }),
    prisma.department.create({ data: { name: "Leadership", companyId: companies[2].id } }),
    prisma.department.create({ data: { name: "Customer Success", companyId: companies[3].id } }),
    prisma.department.create({ data: { name: "Finance", companyId: companies[2].id } }),
    prisma.department.create({ data: { name: "Guest Experience", companyId: companies[4].id } })
  ]);

  const demoUsers = await Promise.all([
    prisma.user.create({ data: { name: "Maya Employee", email: "employee@demo.com", passwordHash: hash, role: "EMPLOYEE", companyId: companies[0].id, departmentId: departments[1].id, avatar: "ME" } }),
    prisma.user.create({ data: { name: "Harper HR", email: "hr@demo.com", passwordHash: hash, role: "HR_ADMIN", companyId: companies[0].id, departmentId: departments[0].id, avatar: "HH" } }),
    prisma.user.create({ data: { name: "Talia Trainer", email: "trainer@demo.com", passwordHash: hash, role: "TRAINER", companyId: companies[0].id, departmentId: departments[4].id, avatar: "TT" } }),
    prisma.user.create({ data: { name: "Cameron Company", email: "company@demo.com", passwordHash: hash, role: "CORPORATE_ADMIN", companyId: companies[0].id, departmentId: departments[0].id, avatar: "CC" } }),
    prisma.user.create({ data: { name: "Sage Admin", email: "admin@demo.com", passwordHash: hash, role: "SUPER_ADMIN", avatar: "SA" } })
  ]);

  const trainerUsers = await Promise.all(
    ["Amara Wells", "Jonas Reed", "Nina Patel", "Leo Chen", "Mara Sol", "Darius Quinn"].map((name, index) =>
      prisma.user.create({
        data: {
          name,
          email: `trainer${index + 2}@demo.com`,
          passwordHash: hash,
          role: "TRAINER",
          companyId: companies[index % companies.length].id,
          departmentId: departments[index % departments.length].id,
          avatar: name.split(" ").map((part) => part[0]).join("")
        }
      })
    )
  );
  const allTrainers = [demoUsers[2], ...trainerUsers];

  const employees = await Promise.all(
    Array.from({ length: 25 }).map((_, index) =>
      prisma.user.create({
        data: {
          name: ["Ava Morgan", "Noah Park", "Lina Ross", "Theo Malik", "Iris Stone", "Owen Shaw", "Elena Cruz", "Kai Bennett", "Mina Hart", "Rowan Lee", "Sofia King", "Eli Brooks", "Nora Lane", "Adam Wells", "Priya Shah", "Jules Carter", "Rae Collins", "Samira Noor", "Felix Grant", "Tessa Bloom", "Marco Reyes", "Anika Sen", "Milo Hart", "Clara Finch", "Zane Patel"][index],
          email: `employee${index + 2}@demo.com`,
          passwordHash: hash,
          role: "EMPLOYEE",
          companyId: companies[index % companies.length].id,
          departmentId: departments[index % departments.length].id,
          avatar: `E${index + 2}`
        }
      })
    )
  );
  const learners = [demoUsers[0], ...employees];

  const createdCourses = [];
  for (const [index, course] of courses.entries()) {
    const created = await prisma.course.create({
      data: {
        title: String(course[0]),
        category: String(course[1]),
        description: String(course[2]),
        level: String(course[3]),
        duration: String(course[4]),
        format: String(course[5]),
        price: Number(course[6]),
        certificationAvailable: Boolean(course[7]),
        instructorId: allTrainers[index % allTrainers.length].id,
        image: images[index % images.length],
        rating: 4.6 + ((index % 4) * 0.1),
        enrolledCount: 120 + index * 37,
        tags: JSON.stringify([String(course[1]), "Dharma Space", "Corporate Ready"]),
        learningOutcomes: JSON.stringify([
          "Build a repeatable professional practice",
          "Apply skills in team and leadership contexts",
          "Track progress with calm, evidence-informed routines"
        ]),
        modules: {
          create: [1, 2, 3, 4].map((moduleIndex) => ({
            title: `Module ${moduleIndex}: ${moduleIndex === 1 ? "Foundation" : moduleIndex === 2 ? "Practice" : moduleIndex === 3 ? "Integration" : "Certification"}`,
            description: "Guided lessons, reflective prompts, and workplace application exercises.",
            order: moduleIndex,
            duration: "45 min"
          }))
        }
      }
    });
    createdCourses.push(created);
  }

  for (let i = 0; i < learners.length; i++) {
    for (const course of createdCourses.slice(i % 4, (i % 4) + 3)) {
      const progress = 25 + ((i * 13) % 76);
      await prisma.enrollment.create({
        data: {
          userId: learners[i].id,
          courseId: course.id,
          progress,
          status: progress >= 95 ? "COMPLETED" : "ACTIVE",
          completedAt: progress >= 95 ? new Date() : null
        }
      });
    }
  }

  const badges = await Promise.all([
    ["Stress Recovery Milestone", "Completed a sustained recovery practice.", "Recovery", "Leaf"],
    ["Mindfulness Consistency Award", "Maintained mindful routines across a work cycle.", "Presence", "Sparkles"],
    ["Breathwork Practitioner", "Demonstrated breathwork fundamentals.", "Wellness", "Wind"],
    ["Emotional Intelligence Certified", "Completed EI certification requirements.", "Empathy", "Heart"],
    ["Corporate Wellness Leader", "Led workplace wellbeing adoption.", "Leadership", "Crown"],
    ["Dharma Space Pioneer", "Early adopter of Dharma Space.", "Dharma Space", "Compass"],
    ["Burnout Prevention Facilitator", "Qualified to facilitate prevention rituals.", "Facilitation", "Shield"]
  ].map(([name, description, category, icon]) => prisma.badge.create({ data: { name, description, category, icon } })));

  for (const user of learners.slice(0, 8)) {
    await prisma.userBadge.create({ data: { userId: user.id, badgeId: badges[learners.indexOf(user) % badges.length].id } });
  }

  for (const user of learners) {
    for (let day = 0; day < 8; day++) {
      await prisma.wellbeingCheckin.create({
        data: {
          userId: user.id,
          mood: 3 + ((day + learners.indexOf(user)) % 3),
          stress: 1 + ((day + 2) % 5),
          energy: 2 + ((day + 1) % 4),
          sleep: 2 + (day % 4),
          focus: 3 + (day % 3),
          note: user.email === "employee@demo.com" ? "Felt calmer after the reset routine." : null,
          createdAt: new Date(Date.now() - day * 86400000)
        }
      });
    }
  }

  for (const [index, course] of createdCourses.entries()) {
    const trainer = allTrainers[index % allTrainers.length];
    const session = await prisma.session.create({
      data: {
        courseId: course.id,
        trainerId: trainer.id,
        title: `${course.title} Live Lab`,
        startTime: new Date(Date.now() + (index + 1) * 86400000),
        endTime: new Date(Date.now() + (index + 1) * 86400000 + 5400000),
        location: index % 2 ? "Virtual Studio" : "Asteria HQ Wellness Suite",
        format: index % 2 ? "ONLINE" : "HYBRID"
      }
    });
    for (const learner of learners.slice(0, 8)) {
      await prisma.attendance.create({ data: { sessionId: session.id, userId: learner.id, status: index % 3 === 0 ? "REGISTERED" : "ATTENDED" } });
    }
  }

  for (const learner of learners.slice(0, 5)) {
    await prisma.certificate.create({
      data: {
        userId: learner.id,
        courseId: createdCourses[learners.indexOf(learner) % createdCourses.length].id,
        certificateNumber: `HSOS-2026-${String(learners.indexOf(learner) + 1).padStart(4, "0")}`,
        verified: true
      }
    });
  }

  const challengeNames = [
    "30-Day Stress Recovery Challenge",
    "Mindful Leadership Month",
    "Energy Optimization Sprint",
    "Workplace Wellness Journey",
    "Breathwork Week"
  ];
  for (const [index, title] of challengeNames.entries()) {
    const challenge = await prisma.challenge.create({
      data: {
        companyId: companies[index % companies.length].id,
        title,
        description: "A calm, opt-in participation challenge focused on collective momentum, not individual ranking.",
        startDate: new Date(Date.now() - 7 * 86400000),
        endDate: new Date(Date.now() + (21 + index) * 86400000),
        rewardBadgeId: badges[index % badges.length].id
      }
    });
    for (const learner of learners.filter((user) => user.companyId === challenge.companyId).slice(0, 6)) {
      const progress = 35 + ((index + learners.indexOf(learner)) * 11) % 65;
      await prisma.challengeParticipation.create({ data: { challengeId: challenge.id, userId: learner.id, progress, completed: progress > 85 } });
    }
  }

  for (const company of companies) {
    await prisma.invoice.create({ data: { companyId: company.id, amount: company.plan === "Enterprise" ? 24000 : 12000, status: "PAID", dueDate: new Date(Date.now() + 30 * 86400000) } });
    await prisma.invoice.create({ data: { companyId: company.id, amount: company.plan === "Enterprise" ? 24000 : 12000, status: "OPEN", dueDate: new Date(Date.now() + 60 * 86400000) } });
  }

  const categoryDefs = [
    { name: "Wellness Talk & Workshop", scoreValue: 30, icon: "🎤" },
    { name: "Wellness Lecture", scoreValue: 30, icon: "📚" },
    { name: "Ayurveda Talk", scoreValue: 30, icon: "🌿" },
    { name: "Leadership Talk", scoreValue: 35, icon: "🎯" },
    { name: "Yoga Class", scoreValue: 50, icon: "🧘" },
    { name: "Breathwork", scoreValue: 45, icon: "🌬️" },
    { name: "Meditation Class", scoreValue: 40, icon: "🕯️" },
    { name: "Pilates", scoreValue: 50, icon: "🤸" },
    { name: "Sound Healing Session", scoreValue: 40, icon: "🎵" },
    { name: "Team Building Activity", scoreValue: 60, icon: "🤝" }
  ];
  for (const cat of categoryDefs) {
    await prisma.wellnessEventCategory.upsert({
      where: { name: cat.name },
      create: cat,
      update: cat
    });
  }

  const cwpBadgeDefs: Array<[string, string, string]> = [
    ["Breathwork Survivor", "Survived your first breathwork session.", "🌬️"],
    ["Chair Yoga Warrior", "Three yoga classes and counting.", "🧘"],
    ["Hydration Deity", "Logged wellness steps five days.", "💧"],
    ["Silent Savasana Champion", "Five meditation classes completed.", "🕯️"],
    ["Spreadsheet Monk", "Leadership talk plus wellness workshop.", "📊"],
    ["Slack Notification Yogi", "Three bookings in one week.", "📱"],
    ["Caffeine Recovery Specialist", "Attended a morning session before 9am.", "☕"],
    ["CEO of Deep Breathing", "76%+ attendance rate.", "🫁"],
    ["Sound Healer Initiate", "First sound healing session.", "🎵"],
    ["Team Player", "Two team building activities.", "🤝"],
    ["Early Bird", "Booked a session 7+ days ahead.", "🐦"],
    ["Corporate Dragon Tamer", "Reached Corporate Dragon wellness level.", "🐉"]
  ];
  for (const [name, description, icon] of cwpBadgeDefs) {
    await prisma.badge.upsert({
      where: { name },
      create: { name, description, category: "CWP", icon },
      update: { description, category: "CWP", icon }
    });
  }

  const yogaCategory = await prisma.wellnessEventCategory.findFirst({ where: { name: "Yoga Class" } });
  const breathCategory = await prisma.wellnessEventCategory.findFirst({ where: { name: "Breathwork" } });
  const trainer = demoUsers[2];
  const hrUser = demoUsers[1];
  if (yogaCategory && breathCategory && trainer && hrUser) {
    const inThreeDays = new Date(Date.now() + 3 * 86400000);
    inThreeDays.setHours(10, 0, 0, 0);
    const inOneWeek = new Date(Date.now() + 7 * 86400000);
    inOneWeek.setHours(18, 30, 0, 0);
    await prisma.wellnessEvent.createMany({
      data: [
        {
          companyId: companies[0].id,
          categoryId: yogaCategory.id,
          trainerId: trainer.id,
          title: "Morning Desk Yoga Reset",
          dateTime: inThreeDays,
          durationMinutes: 45,
          locationType: "online",
          locationDetail: "https://zoom.us/j/demo-yoga",
          maxSpots: 30,
          createdById: hrUser.id
        },
        {
          companyId: companies[0].id,
          categoryId: breathCategory.id,
          trainerId: trainer.id,
          title: "Executive Breathwork Circle",
          dateTime: inOneWeek,
          durationMinutes: 60,
          locationType: "dharma_space",
          locationDetail: "Dharma Space Studio A",
          maxSpots: 20,
          createdById: hrUser.id
        }
      ]
    });
  }

  // Demo messenger thread between Maya (employee) and Harper (HR).
  const [mayaEmployee, harperHr] = [demoUsers[0], demoUsers[1]];
  const demoConversation = await prisma.conversation.create({
    data: {
      companyId: companies[0].id,
      participants: { create: [{ userId: mayaEmployee.id }, { userId: harperHr.id }] }
    }
  });
  const baseTime = Date.now() - 1000 * 60 * 60 * 26;
  const demoThread: Array<[string, string]> = [
    [harperHr.id, "Hi Maya! Just checking in — how are you finding the breathwork sessions?"],
    [mayaEmployee.id, "Hey Harper! Loving them, the morning coherence one really helps me focus."],
    [harperHr.id, "That's wonderful to hear. We're adding a Desk Yoga Reset next week if you'd like to join."],
    [mayaEmployee.id, "Yes please, count me in!"]
  ];
  for (let i = 0; i < demoThread.length; i += 1) {
    const [senderId, body] = demoThread[i];
    await prisma.message.create({
      data: { conversationId: demoConversation.id, senderId, body, createdAt: new Date(baseTime + i * 1000 * 60 * 7) }
    });
  }
  // Harper has read everything; Maya has one unread (the last message from Harper is read,
  // but leave Maya's lastReadAt earlier so the badge demonstrates unread state).
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: demoConversation.id, userId: harperHr.id } },
    data: { lastReadAt: new Date(baseTime + demoThread.length * 1000 * 60 * 7) }
  });

  console.log("Seeded Dharma Space demo data.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
