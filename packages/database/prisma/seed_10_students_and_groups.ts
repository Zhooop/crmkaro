import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });
dotenv.config();

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/client.js";

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const STUDENTS_DATA = [
  {
    displayName: "Aarav Sharma",
    rollNumber: "STU-10-001",
    primaryPhone: "+91 98231 10001",
    email: "aarav.sharma@example.com",
    guardianName: "Rajesh Sharma",
    guardianPhone: "+91 98231 20001",
    guardianRelation: "Father",
    standard: "Class 10th",
    batch: "Morning Super 30 (Class 10th)",
    feeAmountMinor: 150000, // ₹1,500 / month
    feeDisplay: "₹1,500",
  },
  {
    displayName: "Ananya Verma",
    rollNumber: "STU-10-002",
    primaryPhone: "+91 98231 10002",
    email: "ananya.verma@example.com",
    guardianName: "Sunil Verma",
    guardianPhone: "+91 98231 20002",
    guardianRelation: "Father",
    standard: "Class 10th",
    batch: "Morning Super 30 (Class 10th)",
    feeAmountMinor: 200000, // ₹2,000 / month
    feeDisplay: "₹2,000",
  },
  {
    displayName: "Rohan Gupta",
    rollNumber: "STU-10-003",
    primaryPhone: "+91 98231 10003",
    email: "rohan.gupta@example.com",
    guardianName: "Deepak Gupta",
    guardianPhone: "+91 98231 20003",
    guardianRelation: "Father",
    standard: "Class 10th",
    batch: "Morning Super 30 (Class 10th)",
    feeAmountMinor: 250000, // ₹2,500 / month
    feeDisplay: "₹2,500",
  },
  {
    displayName: "Priya Patel",
    rollNumber: "STU-11-004",
    primaryPhone: "+91 98231 10004",
    email: "priya.patel@example.com",
    guardianName: "Kirit Patel",
    guardianPhone: "+91 98231 20004",
    guardianRelation: "Father",
    standard: "Class 11th",
    batch: "IIT-JEE Foundation (Class 11th)",
    feeAmountMinor: 300000, // ₹3,000 / month
    feeDisplay: "₹3,000",
  },
  {
    displayName: "Kabir Singh",
    rollNumber: "STU-11-005",
    primaryPhone: "+91 98231 10005",
    email: "kabir.singh@example.com",
    guardianName: "Harpreet Singh",
    guardianPhone: "+91 98231 20005",
    guardianRelation: "Father",
    standard: "Class 11th",
    batch: "IIT-JEE Foundation (Class 11th)",
    feeAmountMinor: 350000, // ₹3,500 / month
    feeDisplay: "₹3,500",
  },
  {
    displayName: "Sneha Reddy",
    rollNumber: "STU-11-006",
    primaryPhone: "+91 98231 10006",
    email: "sneha.reddy@example.com",
    guardianName: "Venkatesh Reddy",
    guardianPhone: "+91 98231 20006",
    guardianRelation: "Father",
    standard: "Class 11th",
    batch: "IIT-JEE Foundation (Class 11th)",
    feeAmountMinor: 400000, // ₹4,000 / month
    feeDisplay: "₹4,000",
  },
  {
    displayName: "Aditya Joshi",
    rollNumber: "STU-12-007",
    primaryPhone: "+91 98231 10007",
    email: "aditya.joshi@example.com",
    guardianName: "Manoj Joshi",
    guardianPhone: "+91 98231 20007",
    guardianRelation: "Father",
    standard: "Class 12th",
    batch: "Board Exam Booster (Class 12th)",
    feeAmountMinor: 450000, // ₹4,500 / month
    feeDisplay: "₹4,500",
  },
  {
    displayName: "Ishaan Malhotra",
    rollNumber: "STU-12-008",
    primaryPhone: "+91 98231 10008",
    email: "ishaan.malhotra@example.com",
    guardianName: "Raman Malhotra",
    guardianPhone: "+91 98231 20008",
    guardianRelation: "Father",
    standard: "Class 12th",
    batch: "Board Exam Booster (Class 12th)",
    feeAmountMinor: 500000, // ₹5,000 / month
    feeDisplay: "₹5,000",
  },
  {
    displayName: "Diya Nair",
    rollNumber: "STU-12-009",
    primaryPhone: "+91 98231 10009",
    email: "diya.nair@example.com",
    guardianName: "Suresh Nair",
    guardianPhone: "+91 98231 20009",
    guardianRelation: "Father",
    standard: "Class 12th",
    batch: "Board Exam Booster (Class 12th)",
    feeAmountMinor: 550000, // ₹5,500 / month
    feeDisplay: "₹5,500",
  },
  {
    displayName: "Aryan Kapoor",
    rollNumber: "STU-12-010",
    primaryPhone: "+91 98231 10010",
    email: "aryan.kapoor@example.com",
    guardianName: "Vikram Kapoor",
    guardianPhone: "+91 98231 20010",
    guardianRelation: "Father",
    standard: "Class 12th",
    batch: "Weekend Advanced Olympiad",
    feeAmountMinor: 600000, // ₹6,000 / month
    feeDisplay: "₹6,000",
  },
];

const BATCH_GROUPS = [
  {
    name: "Morning Super 30 (Class 10th)",
    code: "CLS10-MORN",
    description: "Daily morning batch for Class 10 Science & Mathematics with weekly mock tests.",
    color: "#2563eb", // Blue
    feeAmountMinor: 200000,
    workingDays: "M,W,F",
    studentIndexes: [0, 1, 2], // 3 students: Aarav, Ananya, Rohan
  },
  {
    name: "IIT-JEE Foundation (Class 11th)",
    code: "IIT-FND-11",
    description: "Evening rigorous foundation batch for Physics, Chemistry & Advanced Mathematics.",
    color: "#059669", // Emerald
    feeAmountMinor: 350000,
    workingDays: "T,Th,S",
    studentIndexes: [3, 4, 5], // 3 students: Priya, Kabir, Sneha
  },
  {
    name: "Board Exam Booster (Class 12th)",
    code: "CLS12-BOOST",
    description: "Focused board exam preparation, revision cycles, and sample paper solving.",
    color: "#7c3aed", // Purple
    feeAmountMinor: 500000,
    workingDays: "M,W,F",
    studentIndexes: [6, 7, 8], // 3 students: Aditya, Ishaan, Diya
  },
  {
    name: "Weekend Advanced Olympiad",
    code: "OLYMP-ADV",
    description: "Weekend intensive batch for Olympiads and competitive national level tests.",
    color: "#d97706", // Amber
    feeAmountMinor: 600000,
    workingDays: "S,Su",
    studentIndexes: [9, 4, 6], // 3 students: Aryan Kapoor + Kabir Singh & Aditya Joshi (cross-enrolled)
  },
];

async function seedStudentsAndGroups() {
  console.log("Connecting to database...");
  await database.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;

  // Find target organisations: Test Org and Zhoop InfoTech
  const targetOrgs = await database.organisation.findMany({
    where: {
      OR: [
        { name: "Test Org" },
        { name: { contains: "Zhoop", mode: "insensitive" } },
      ],
    },
  });

  if (targetOrgs.length === 0) {
    throw new Error("No target organisation found!");
  }

  console.log(`Found ${targetOrgs.length} target organisation(s):`, targetOrgs.map(o => `${o.name} (${o.id})`));

  for (const org of targetOrgs) {
    console.log(`\n========================================`);
    console.log(`Seeding Students & Batches for: ${org.name}`);
    console.log(`========================================`);

    const createdPersons: Array<{ id: string; studentProfileId: string; name: string }> = [];

    // 1. Create 10 Students
    for (const data of STUDENTS_DATA) {
      // Find or create Person
      let person = await database.person.findFirst({
        where: {
          organisationId: org.id,
          displayName: data.displayName,
        },
      });

      if (!person) {
        person = await database.person.create({
          data: {
            organisationId: org.id,
            displayName: data.displayName,
            primaryPhone: data.primaryPhone,
            primaryPhoneNormalised: data.primaryPhone.replace(/\D/g, ""),
            email: data.email,
            emailNormalised: data.email.toLowerCase(),
            status: "ACTIVE",
          },
        });
      } else {
        await database.person.update({
          where: { id: person.id },
          data: {
            primaryPhone: data.primaryPhone,
            email: data.email,
            status: "ACTIVE",
          },
        });
      }

      // Ensure STUDENT type assignment
      await database.personTypeAssignment.upsert({
        where: {
          personId_type: {
            personId: person.id,
            type: "STUDENT",
          },
        },
        update: {},
        create: {
          organisationId: org.id,
          personId: person.id,
          type: "STUDENT",
        },
      });

      // Upsert StudentProfile
      const profile = await database.studentProfile.upsert({
        where: {
          personId: person.id,
        },
        update: {
          rollNumber: data.rollNumber,
          standard: data.standard,
          batch: data.batch,
          guardianName: data.guardianName,
          guardianPhone: data.guardianPhone,
          guardianRelation: data.guardianRelation,
          feeFrequency: "MONTHLY",
          feeAmountMinor: data.feeAmountMinor,
          status: "ACTIVE",
        },
        create: {
          organisationId: org.id,
          personId: person.id,
          rollNumber: data.rollNumber,
          standard: data.standard,
          batch: data.batch,
          guardianName: data.guardianName,
          guardianPhone: data.guardianPhone,
          guardianRelation: data.guardianRelation,
          feeFrequency: "MONTHLY",
          feeAmountMinor: data.feeAmountMinor,
          status: "ACTIVE",
          admissionDate: new Date(),
          billingStartDate: new Date(),
        },
      });

      createdPersons.push({
        id: person.id,
        studentProfileId: profile.id,
        name: data.displayName,
      });

      console.log(`  ✓ Student: ${data.displayName} | Roll: ${data.rollNumber} | Fee: ${data.feeDisplay}/mo | Batch: ${data.batch}`);
    }

    // 2. Create 3-3 Batch Groups
    for (const batch of BATCH_GROUPS) {
      const group = await database.batchGroup.upsert({
        where: {
          organisationId_name: {
            organisationId: org.id,
            name: batch.name,
          },
        },
        update: {
          code: batch.code,
          description: batch.description,
          color: batch.color,
          feeAmountMinor: batch.feeAmountMinor,
          feeFrequency: "MONTHLY",
          workingDays: batch.workingDays,
          isActive: true,
        },
        create: {
          organisationId: org.id,
          name: batch.name,
          code: batch.code,
          description: batch.description,
          color: batch.color,
          feeAmountMinor: batch.feeAmountMinor,
          feeFrequency: "MONTHLY",
          workingDays: batch.workingDays,
          isActive: true,
          startDate: new Date(),
        },
      });

      console.log(`\n  🎯 Batch Group: ${batch.name} (${batch.code}) [${batch.workingDays}]`);

      // Assign 3 students to this batch
      for (const idx of batch.studentIndexes) {
        const student = createdPersons[idx];
        const studentFee = STUDENTS_DATA[idx].feeAmountMinor;

        await database.groupMember.upsert({
          where: {
            groupId_personId: {
              groupId: group.id,
              personId: student.id,
            },
          },
          update: {
            customFeeMinor: studentFee,
            status: "ACTIVE",
          },
          create: {
            organisationId: org.id,
            groupId: group.id,
            personId: student.id,
            customFeeMinor: studentFee,
            status: "ACTIVE",
            startDate: new Date(),
          },
        });

        console.log(`     -> Enrolled: ${student.name} (Custom Fee: ${STUDENTS_DATA[idx].feeDisplay})`);
      }
    }

    // 3. Mark attendance records for today so attendance view is lively
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const [idx, student] of createdPersons.entries()) {
      // 8 present, 1 leave, 1 absent
      const status = idx === 4 ? "LEAVE" : idx === 7 ? "ABSENT" : "PRESENT";
      const remarks = status === "PRESENT" ? "Attended regular lecture" : status === "LEAVE" ? "Medical leave submitted" : "Informed absent";

      await database.attendanceRecord.upsert({
        where: {
          organisationId_studentProfileId_date: {
            organisationId: org.id,
            studentProfileId: student.studentProfileId,
            date: today,
          },
        },
        update: {
          status,
          remarks,
        },
        create: {
          organisationId: org.id,
          studentProfileId: student.studentProfileId,
          personId: student.id,
          date: today,
          status,
          remarks,
        },
      });
    }
    console.log(`\n  ✓ Generated today's attendance records for all 10 students.`);
  }

  console.log("\n✅ Seeding complete! All 10 students and batches created successfully.");
}

seedStudentsAndGroups()
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  })
  .finally(() => database.$disconnect());
