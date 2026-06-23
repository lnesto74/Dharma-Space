import type { Express, NextFunction, Request, Response } from "express";
import type { PrismaClient, User } from "@prisma/client";
import { z } from "zod";

type AuthedRequest = Request & { user?: User };

const CONTACT_SELECT = {
  id: true,
  name: true,
  role: true,
  avatar: true,
  companyId: true,
  department: { select: { name: true } }
} as const;

const sendSchema = z.object({ body: z.string().trim().min(1).max(4000) });
const startSchema = z.object({ userId: z.string().min(1) });

export function registerMessagingRoutes(
  app: Express,
  prisma: PrismaClient,
  auth: (req: AuthedRequest, res: Response, next: NextFunction) => void
) {
  // Who the current user is allowed to message. Everyone can reach colleagues in
  // their own company (employees <-> HR <-> corporate admins). Trainers and the
  // Dharma Admin, who may not belong to a single company, can reach company
  // managers across the platform.
  async function contactsFor(user: User) {
    if (user.role === "SUPER_ADMIN") {
      return prisma.user.findMany({
        where: { id: { not: user.id }, role: { in: ["HR_ADMIN", "CORPORATE_ADMIN", "TRAINER"] } },
        select: CONTACT_SELECT,
        orderBy: { name: "asc" }
      });
    }
    if (user.companyId) {
      return prisma.user.findMany({
        where: { id: { not: user.id }, companyId: user.companyId },
        select: CONTACT_SELECT,
        orderBy: { name: "asc" }
      });
    }
    // Trainer with no company assignment — let them reach company managers.
    return prisma.user.findMany({
      where: { id: { not: user.id }, role: { in: ["HR_ADMIN", "CORPORATE_ADMIN"] } },
      select: CONTACT_SELECT,
      orderBy: { name: "asc" }
    });
  }

  async function canMessage(user: User, targetId: string) {
    if (targetId === user.id) return false;
    const contacts = await contactsFor(user);
    return contacts.some((c) => c.id === targetId);
  }

  async function assertMember(conversationId: string, userId: string) {
    return prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } }
    });
  }

  async function getOrCreateDirect(aId: string, bId: string, companyId: string | null) {
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: aId } } },
          { participants: { some: { userId: bId } } }
        ]
      },
      include: { participants: true }
    });
    if (existing && existing.participants.length === 2) return existing;
    return prisma.conversation.create({
      data: {
        companyId,
        participants: { create: [{ userId: aId }, { userId: bId }] }
      },
      include: { participants: true }
    });
  }

  function otherParticipant(
    participants: Array<{ userId: string; user: { id: string; name: string; role: string; avatar: string | null } }>,
    meId: string
  ) {
    const other = participants.find((p) => p.userId !== meId)?.user;
    return other
      ? { id: other.id, name: other.name, role: other.role, avatar: other.avatar }
      : { id: meId, name: "You", role: "", avatar: null };
  }

  // Contacts the current user can start a conversation with.
  app.get("/api/messages/contacts", auth, async (req: AuthedRequest, res, next) => {
    try {
      const contacts = await contactsFor(req.user!);
      res.json({
        contacts: contacts.map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role,
          avatar: c.avatar,
          department: c.department?.name || null
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // All conversation threads for the current user with last message + unread count.
  app.get("/api/messages/threads", auth, async (req: AuthedRequest, res, next) => {
    try {
      const me = req.user!.id;
      const memberships = await prisma.conversationParticipant.findMany({
        where: { userId: me },
        include: {
          conversation: {
            include: {
              participants: { include: { user: { select: { id: true, name: true, role: true, avatar: true } } } },
              messages: { orderBy: { createdAt: "desc" }, take: 1 }
            }
          }
        }
      });

      const threads = await Promise.all(
        memberships.map(async (m) => {
          const last = m.conversation.messages[0];
          const unread = await prisma.message.count({
            where: {
              conversationId: m.conversationId,
              senderId: { not: me },
              ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {})
            }
          });
          return {
            id: m.conversationId,
            other: otherParticipant(m.conversation.participants, me),
            lastMessage: last ? { body: last.body, createdAt: last.createdAt, mine: last.senderId === me } : null,
            unread,
            updatedAt: m.conversation.updatedAt
          };
        })
      );

      threads.sort((a, b) => {
        const at = a.lastMessage?.createdAt?.getTime() ?? a.updatedAt.getTime();
        const bt = b.lastMessage?.createdAt?.getTime() ?? b.updatedAt.getTime();
        return bt - at;
      });

      res.json({ threads });
    } catch (error) {
      next(error);
    }
  });

  // Total unread messages across all threads (for the floating badge).
  app.get("/api/messages/unread-count", auth, async (req: AuthedRequest, res, next) => {
    try {
      const me = req.user!.id;
      const memberships = await prisma.conversationParticipant.findMany({ where: { userId: me } });
      let count = 0;
      for (const m of memberships) {
        count += await prisma.message.count({
          where: {
            conversationId: m.conversationId,
            senderId: { not: me },
            ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {})
          }
        });
      }
      res.json({ count });
    } catch (error) {
      next(error);
    }
  });

  // Start (or fetch existing) a direct conversation with a contact.
  app.post("/api/messages/threads", auth, async (req: AuthedRequest, res, next) => {
    try {
      const parsed = startSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "A target user is required." });
      const { userId } = parsed.data;
      if (!(await canMessage(req.user!, userId))) {
        return res.status(403).json({ message: "You can only message people in your organization." });
      }
      const conversation = await getOrCreateDirect(req.user!.id, userId, req.user!.companyId ?? null);
      const full = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: { participants: { include: { user: { select: { id: true, name: true, role: true, avatar: true } } } } }
      });
      res.json({
        thread: {
          id: conversation.id,
          other: otherParticipant(full!.participants, req.user!.id),
          lastMessage: null,
          unread: 0
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // Messages within a conversation (oldest first). Marks the thread as read.
  app.get("/api/messages/threads/:id/messages", auth, async (req: AuthedRequest, res, next) => {
    try {
      const me = req.user!.id;
      const member = await assertMember(req.params.id, me);
      if (!member) return res.status(404).json({ message: "Conversation not found." });

      const [conversation, messages] = await Promise.all([
        prisma.conversation.findUnique({
          where: { id: req.params.id },
          include: { participants: { include: { user: { select: { id: true, name: true, role: true, avatar: true } } } } }
        }),
        prisma.message.findMany({ where: { conversationId: req.params.id }, orderBy: { createdAt: "asc" } })
      ]);

      await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: req.params.id, userId: me } },
        data: { lastReadAt: new Date() }
      });

      res.json({
        thread: { id: req.params.id, other: otherParticipant(conversation!.participants, me) },
        messages: messages.map((msg) => ({
          id: msg.id,
          body: msg.body,
          createdAt: msg.createdAt,
          mine: msg.senderId === me
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // Send a message into a conversation.
  app.post("/api/messages/threads/:id/messages", auth, async (req: AuthedRequest, res, next) => {
    try {
      const me = req.user!.id;
      const member = await assertMember(req.params.id, me);
      if (!member) return res.status(404).json({ message: "Conversation not found." });

      const parsed = sendSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Message cannot be empty." });

      const message = await prisma.message.create({
        data: { conversationId: req.params.id, senderId: me, body: parsed.data.body }
      });
      await prisma.conversation.update({ where: { id: req.params.id }, data: { updatedAt: new Date() } });
      await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: req.params.id, userId: me } },
        data: { lastReadAt: new Date() }
      });

      res.status(201).json({
        message: { id: message.id, body: message.body, createdAt: message.createdAt, mine: true }
      });
    } catch (error) {
      next(error);
    }
  });

  // Mark a conversation as read.
  app.post("/api/messages/threads/:id/read", auth, async (req: AuthedRequest, res, next) => {
    try {
      const me = req.user!.id;
      const member = await assertMember(req.params.id, me);
      if (!member) return res.status(404).json({ message: "Conversation not found." });
      await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: req.params.id, userId: me } },
        data: { lastReadAt: new Date() }
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
}
