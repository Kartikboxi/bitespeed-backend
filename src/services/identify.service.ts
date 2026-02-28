import { prisma } from "../config/db";
import { Contact } from "@prisma/client";

export const identifyService = async (
  email?: string,
  phoneNumber?: string
) => {
  if (!email && !phoneNumber) {
    throw new Error("At least one of email or phoneNumber is required");
  }

  return await prisma.$transaction(async (tx) => {
    // Find contacts that match incoming email or phone
    const existingContacts = await tx.contact.findMany({
      where: {
        OR: [
          email ? { email } : undefined,
          phoneNumber ? { phoneNumber } : undefined
        ].filter(Boolean) as any
      }
    });

    // If nothing matches, create a new primary contact
    if (existingContacts.length === 0) {
      const newPrimary = await tx.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "primary"
        }
      });

      return buildResponse(newPrimary.id, [newPrimary]);
    }

    // Collect primary IDs related to the matches
    const primaryIds = new Set<number>();

    existingContacts.forEach((contact) => {
      if (contact.linkPrecedence === "primary") {
        primaryIds.add(contact.id);
      } else if (contact.linkedId) {
        primaryIds.add(contact.linkedId);
      }
    });

    // Get full group of contacts connected to those primaries
    const fullGroup = await tx.contact.findMany({
      where: {
        OR: [
          { id: { in: Array.from(primaryIds) } },
          { linkedId: { in: Array.from(primaryIds) } }
        ]
      }
    });

    // Find all primary contacts in the group
    const primaryContacts = fullGroup
      .filter((c) => c.linkPrecedence === "primary")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const oldestPrimary = primaryContacts[0];

    if (!oldestPrimary) {
      throw new Error("Primary contact not found");
    }

    // If multiple primaries exist, convert newer ones to secondary
    for (let i = 1; i < primaryContacts.length; i++) {
      const extraPrimary = primaryContacts[i];

      await tx.contact.update({
        where: { id: extraPrimary.id },
        data: {
          linkPrecedence: "secondary",
          linkedId: oldestPrimary.id
        }
      });

      await tx.contact.updateMany({
        where: { linkedId: extraPrimary.id },
        data: { linkedId: oldestPrimary.id }
      });
    }

    // Check if incoming email or phone is new
    const existingEmails = new Set(
      fullGroup.map((c) => c.email).filter(Boolean)
    );

    const existingPhones = new Set(
      fullGroup.map((c) => c.phoneNumber).filter(Boolean)
    );

    const addNewEmail = email && !existingEmails.has(email);
    const addNewPhone = phoneNumber && !existingPhones.has(phoneNumber);

    if (addNewEmail || addNewPhone) {
      await tx.contact.create({
        data: {
          email,
          phoneNumber,
          linkedId: oldestPrimary.id,
          linkPrecedence: "secondary"
        }
      });
    }

    // Fetch final updated group
    const updatedGroup = await tx.contact.findMany({
      where: {
        OR: [
          { id: oldestPrimary.id },
          { linkedId: oldestPrimary.id }
        ]
      }
    });

    return buildResponse(oldestPrimary.id, updatedGroup);
  });
};

const buildResponse = (primaryId: number, contacts: Contact[]) => {
  const primaryContact = contacts.find((c) => c.id === primaryId);

  if (!primaryContact) {
    throw new Error("Primary contact missing while building response");
  }

  const emails = [
    primaryContact.email,
    ...contacts
      .filter((c) => c.id !== primaryId && c.email)
      .map((c) => c.email)
  ].filter(Boolean);

  const phoneNumbers = [
    primaryContact.phoneNumber,
    ...contacts
      .filter((c) => c.id !== primaryId && c.phoneNumber)
      .map((c) => c.phoneNumber)
  ].filter(Boolean);

  const secondaryContactIds = contacts
    .filter((c) => c.linkPrecedence === "secondary")
    .map((c) => c.id);

  return {
    contact: {
      primaryContactId: primaryId,
      emails: Array.from(new Set(emails)),
      phoneNumbers: Array.from(new Set(phoneNumbers)),
      secondaryContactIds
    }
  };
};