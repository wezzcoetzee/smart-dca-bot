import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import prisma from "../lib/db";
import { MultiplierType } from "@/generated/prisma/enums";

async function main() {
  console.log("Seeding database...");

  await seedMultiplierConfiguration();
  await seedAppConfiguration();
}

async function seedMultiplierConfiguration() {
  await prisma.multiplierConfiguration.deleteMany({});
  console.log("Cleared existing multiplier configurations");

  const multipliers = [
    {
      type: "MOVING_AVERAGE",
      value: "EXTERNALLY_SET",
      multiplier: 2.0,
    },
    {
      type: "LTH_REALIZED_PRICE",
      value: "38599",
      multiplier: 10.0,
    },
    {
      type: "AVERAGE_REALIZED_PRICE",
      value: "56196",
      multiplier: 5.0,
    },
    {
      type: "LTH_BUYING",
      value: "false",
      multiplier: 5.0,
    },
  ];

  for (const multiplier of multipliers) {
    await prisma.multiplierConfiguration.create({
      data: {
        type: multiplier.type as MultiplierType,
        value: multiplier.value,
        multiplier: multiplier.multiplier,
      },
    });
  }
}

async function seedAppConfiguration() {
  await prisma.appConfiguration.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  console.log("Ensured default app configuration exists");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
