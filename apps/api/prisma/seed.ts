/**
 * Seed / fixture data for local development and demos. Idempotent: re-running
 * upserts by natural keys (email / slug) so it is safe to run repeatedly.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

loadDotenv({ path: resolve(process.cwd(), '../../.env'), override: false });
loadDotenv({ override: false });

const prisma = new PrismaClient();

const families = [
  { name: 'Nightshades (Solanaceae)', slug: 'solanaceae', rotationGroup: 'fruiting', description: 'Tomatoes, peppers, potatoes, eggplant.' },
  { name: 'Brassicas (Brassicaceae)', slug: 'brassicaceae', rotationGroup: 'leafy', description: 'Cabbage, broccoli, kale, radish.' },
  { name: 'Legumes (Fabaceae)', slug: 'fabaceae', rotationGroup: 'legume', description: 'Beans, peas — nitrogen fixers.' },
  { name: 'Cucurbits (Cucurbitaceae)', slug: 'cucurbitaceae', rotationGroup: 'fruiting', description: 'Squash, cucumber, melon.' },
  { name: 'Alliums (Amaryllidaceae)', slug: 'amaryllidaceae', rotationGroup: 'allium', description: 'Onion, garlic, leek.' },
  { name: 'Umbellifers (Apiaceae)', slug: 'apiaceae', rotationGroup: 'root', description: 'Carrot, parsley, dill.' },
];

interface PlantSeed {
  commonName: string;
  scientificName?: string;
  slug: string;
  type: 'vegetable' | 'fruit' | 'herb' | 'flower' | 'cover_crop';
  familySlug?: string;
  sun?: 'full_sun' | 'partial_sun' | 'partial_shade' | 'full_shade';
  water?: 'low' | 'medium' | 'high';
  feederType?: 'heavy' | 'medium' | 'light' | 'fixer';
  spacingMm?: number;
  daysToMaturityMin?: number;
  daysToMaturityMax?: number;
  growingTips?: string;
  commonMistakes?: string;
  source?: string;
}

const plants: PlantSeed[] = [
  { commonName: 'Tomato', scientificName: 'Solanum lycopersicum', slug: 'tomato', type: 'vegetable', familySlug: 'solanaceae', sun: 'full_sun', water: 'medium', feederType: 'heavy', spacingMm: 600, daysToMaturityMin: 60, daysToMaturityMax: 85, growingTips: 'Stake or cage early; water at the base to avoid blight.', commonMistakes: 'Planting out before night temps stay above 10°C.', source: 'Gardien starter dataset' },
  { commonName: 'Bell Pepper', scientificName: 'Capsicum annuum', slug: 'bell-pepper', type: 'vegetable', familySlug: 'solanaceae', sun: 'full_sun', water: 'medium', feederType: 'medium', spacingMm: 450, daysToMaturityMin: 60, daysToMaturityMax: 90, commonMistakes: 'Planting near hot peppers can cross-pollinate seed.', source: 'Gardien starter dataset' },
  { commonName: 'Jalapeño', scientificName: 'Capsicum annuum', slug: 'jalapeno', type: 'vegetable', familySlug: 'solanaceae', sun: 'full_sun', water: 'medium', feederType: 'medium', spacingMm: 450, daysToMaturityMin: 70, daysToMaturityMax: 85, source: 'Gardien starter dataset' },
  { commonName: 'Potato', scientificName: 'Solanum tuberosum', slug: 'potato', type: 'vegetable', familySlug: 'solanaceae', sun: 'full_sun', water: 'medium', feederType: 'heavy', spacingMm: 300, daysToMaturityMin: 70, daysToMaturityMax: 120, source: 'Gardien starter dataset' },
  { commonName: 'Bush Bean', scientificName: 'Phaseolus vulgaris', slug: 'bush-bean', type: 'vegetable', familySlug: 'fabaceae', sun: 'full_sun', water: 'medium', feederType: 'fixer', spacingMm: 150, daysToMaturityMin: 50, daysToMaturityMax: 60, growingTips: 'Great nitrogen-fixing follow-on after heavy feeders.', source: 'Gardien starter dataset' },
  { commonName: 'Pea', scientificName: 'Pisum sativum', slug: 'pea', type: 'vegetable', familySlug: 'fabaceae', sun: 'full_sun', water: 'medium', feederType: 'fixer', spacingMm: 100, daysToMaturityMin: 55, daysToMaturityMax: 70, source: 'Gardien starter dataset' },
  { commonName: 'Broccoli', scientificName: 'Brassica oleracea', slug: 'broccoli', type: 'vegetable', familySlug: 'brassicaceae', sun: 'full_sun', water: 'high', feederType: 'heavy', spacingMm: 450, daysToMaturityMin: 60, daysToMaturityMax: 90, source: 'Gardien starter dataset' },
  { commonName: 'Carrot', scientificName: 'Daucus carota', slug: 'carrot', type: 'vegetable', familySlug: 'apiaceae', sun: 'full_sun', water: 'medium', feederType: 'light', spacingMm: 75, daysToMaturityMin: 60, daysToMaturityMax: 80, commonMistakes: 'Sowing in stony soil yields forked roots.', source: 'Gardien starter dataset' },
  { commonName: 'Cucumber', scientificName: 'Cucumis sativus', slug: 'cucumber', type: 'vegetable', familySlug: 'cucurbitaceae', sun: 'full_sun', water: 'high', feederType: 'heavy', spacingMm: 450, daysToMaturityMin: 50, daysToMaturityMax: 70, source: 'Gardien starter dataset' },
  { commonName: 'Onion', scientificName: 'Allium cepa', slug: 'onion', type: 'vegetable', familySlug: 'amaryllidaceae', sun: 'full_sun', water: 'medium', feederType: 'medium', spacingMm: 100, daysToMaturityMin: 90, daysToMaturityMax: 120, source: 'Gardien starter dataset' },
  { commonName: 'Basil', scientificName: 'Ocimum basilicum', slug: 'basil', type: 'herb', sun: 'full_sun', water: 'medium', feederType: 'light', spacingMm: 250, daysToMaturityMin: 50, daysToMaturityMax: 75, growingTips: 'Classic tomato companion; pinch tops to keep bushy.', source: 'Gardien starter dataset' },
  { commonName: 'Marigold', scientificName: 'Tagetes patula', slug: 'marigold', type: 'flower', sun: 'full_sun', water: 'low', feederType: 'light', spacingMm: 200, growingTips: 'Deters many pests; good throughout the bed.', source: 'Gardien starter dataset' },
];

// Companion (+) and antagonist (−) relationships by slug.
const companions: Array<{ a: string; b: string; relation: 'companion' | 'antagonist'; reason: string }> = [
  { a: 'tomato', b: 'basil', relation: 'companion', reason: 'Basil is said to improve tomato vigour and repel pests.' },
  { a: 'tomato', b: 'marigold', relation: 'companion', reason: 'Marigolds deter nematodes and hornworms.' },
  { a: 'tomato', b: 'potato', relation: 'antagonist', reason: 'Share blight and pests; keep apart.' },
  { a: 'bell-pepper', b: 'jalapeno', relation: 'antagonist', reason: 'Cross-pollination affects saved seed.' },
  { a: 'carrot', b: 'onion', relation: 'companion', reason: 'Onions help mask carrots from carrot fly.' },
  { a: 'cucumber', b: 'bush-bean', relation: 'companion', reason: 'Beans fix nitrogen cucumbers appreciate.' },
];

// Curated planting/harvest windows by zone (months 1-12, wrap-around allowed).
interface WindowSeed {
  slug: string;
  zone: string;
  plantStartMonth: number;
  plantEndMonth: number;
  harvestStartMonth?: number;
  harvestEndMonth?: number;
}
const windows: WindowSeed[] = [
  // Zone 7b
  { slug: 'tomato', zone: '7b', plantStartMonth: 4, plantEndMonth: 5, harvestStartMonth: 7, harvestEndMonth: 9 },
  { slug: 'bell-pepper', zone: '7b', plantStartMonth: 5, plantEndMonth: 6, harvestStartMonth: 7, harvestEndMonth: 10 },
  { slug: 'bush-bean', zone: '7b', plantStartMonth: 5, plantEndMonth: 7, harvestStartMonth: 7, harvestEndMonth: 9 },
  { slug: 'broccoli', zone: '7b', plantStartMonth: 8, plantEndMonth: 9, harvestStartMonth: 10, harvestEndMonth: 12 },
  { slug: 'carrot', zone: '7b', plantStartMonth: 3, plantEndMonth: 4, harvestStartMonth: 6, harvestEndMonth: 7 },
  { slug: 'pea', zone: '7b', plantStartMonth: 2, plantEndMonth: 3, harvestStartMonth: 5, harvestEndMonth: 6 },
  // Zone 8a (a touch earlier / longer)
  { slug: 'tomato', zone: '8a', plantStartMonth: 3, plantEndMonth: 5, harvestStartMonth: 6, harvestEndMonth: 9 },
  { slug: 'bell-pepper', zone: '8a', plantStartMonth: 4, plantEndMonth: 5, harvestStartMonth: 6, harvestEndMonth: 10 },
  { slug: 'jalapeno', zone: '8a', plantStartMonth: 4, plantEndMonth: 5, harvestStartMonth: 7, harvestEndMonth: 10 },
  { slug: 'cucumber', zone: '8a', plantStartMonth: 4, plantEndMonth: 6, harvestStartMonth: 6, harvestEndMonth: 9 },
  { slug: 'bush-bean', zone: '8a', plantStartMonth: 4, plantEndMonth: 7, harvestStartMonth: 6, harvestEndMonth: 9 },
  { slug: 'broccoli', zone: '8a', plantStartMonth: 9, plantEndMonth: 10, harvestStartMonth: 11, harvestEndMonth: 1 },
  { slug: 'carrot', zone: '8a', plantStartMonth: 2, plantEndMonth: 3, harvestStartMonth: 5, harvestEndMonth: 6 },
  { slug: 'basil', zone: '8a', plantStartMonth: 4, plantEndMonth: 6, harvestStartMonth: 6, harvestEndMonth: 9 },
];

// Common pests & diseases.
interface IssueSeed {
  slug: string;
  kind: 'pest' | 'disease';
  name: string;
  description?: string;
  management?: string;
}
const issues: IssueSeed[] = [
  { slug: 'tomato', kind: 'pest', name: 'Tomato hornworm', description: 'Large green caterpillars that defoliate plants fast.', management: 'Hand-pick; encourage parasitic wasps; Bt spray.' },
  { slug: 'tomato', kind: 'disease', name: 'Early blight', description: 'Concentric dark leaf spots, lower leaves first.', management: 'Mulch, water at the base, rotate, remove affected leaves.' },
  { slug: 'potato', kind: 'disease', name: 'Late blight', description: 'Water-soaked lesions; can destroy a crop quickly in wet weather.', management: 'Plant resistant varieties; avoid overhead watering; rotate.' },
  { slug: 'broccoli', kind: 'pest', name: 'Cabbage white caterpillar', description: 'Green caterpillars from white butterflies chew leaves.', management: 'Netting; hand-pick; Bt.' },
  { slug: 'cucumber', kind: 'pest', name: 'Cucumber beetle', description: 'Spreads bacterial wilt while feeding.', management: 'Row covers until flowering; trap crops.' },
  { slug: 'carrot', kind: 'pest', name: 'Carrot fly', description: 'Larvae tunnel into roots.', management: 'Fine mesh barriers; interplant with onions; avoid thinning at dusk.' },
];

async function main(): Promise<void> {
  // --- Admin user ---------------------------------------------------------
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123';
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      displayName: 'Garden Owner',
      role: 'owner',
      // Demo location & hardiness zone (Phase 1).
      zipCode: '30301',
      hardinessZone: '8a',
      latitude: 33.749,
      longitude: -84.388,
    },
  });
  console.log(`Seeded admin user: ${admin.email}`);

  // Pre-warm the zone cache so the demo ZIP resolves without the external API.
  await prisma.zoneLookupCache.upsert({
    where: { zip: '30301' },
    update: {},
    create: {
      zip: '30301',
      hardinessZone: '8a',
      latitude: 33.749,
      longitude: -84.388,
      temperatureRange: '10 to 15',
    },
  });

  // --- Families -----------------------------------------------------------
  const familyBySlug = new Map<string, string>();
  for (const f of families) {
    const fam = await prisma.plantFamily.upsert({
      where: { slug: f.slug },
      update: { name: f.name, description: f.description, rotationGroup: f.rotationGroup, source: 'Gardien starter dataset' },
      create: { ...f, source: 'Gardien starter dataset' },
    });
    familyBySlug.set(f.slug, fam.id);
  }

  // --- Plants -------------------------------------------------------------
  const plantBySlug = new Map<string, string>();
  for (const p of plants) {
    const { familySlug, ...rest } = p;
    const plant = await prisma.plant.upsert({
      where: { slug: p.slug },
      update: { ...rest, familyId: familySlug ? familyBySlug.get(familySlug) : null },
      create: { ...rest, familyId: familySlug ? familyBySlug.get(familySlug) : null },
    });
    plantBySlug.set(p.slug, plant.id);
  }

  // --- Companion links ----------------------------------------------------
  for (const c of companions) {
    const aId = plantBySlug.get(c.a);
    const bId = plantBySlug.get(c.b);
    if (!aId || !bId) continue;
    await prisma.companionLink.upsert({
      where: { plantAId_plantBId_relation: { plantAId: aId, plantBId: bId, relation: c.relation } },
      update: { reason: c.reason },
      create: { plantAId: aId, plantBId: bId, relation: c.relation, reason: c.reason, source: 'Gardien starter dataset' },
    });
  }

  // --- Planting windows (curated; ownerId null) ---------------------------
  for (const w of windows) {
    const plantId = plantBySlug.get(w.slug);
    if (!plantId) continue;
    const existing = await prisma.plantingWindow.findFirst({
      where: { plantId, zone: w.zone, ownerId: null },
    });
    const data = {
      plantStartMonth: w.plantStartMonth,
      plantEndMonth: w.plantEndMonth,
      harvestStartMonth: w.harvestStartMonth ?? null,
      harvestEndMonth: w.harvestEndMonth ?? null,
      source: 'Gardien starter dataset',
    };
    if (existing) {
      await prisma.plantingWindow.update({ where: { id: existing.id }, data });
    } else {
      await prisma.plantingWindow.create({ data: { ...data, plantId, zone: w.zone } });
    }
  }

  // --- Pests & diseases (curated) -----------------------------------------
  for (const i of issues) {
    const plantId = plantBySlug.get(i.slug);
    if (!plantId) continue;
    const existing = await prisma.plantIssue.findFirst({
      where: { plantId, name: i.name, ownerId: null },
    });
    if (!existing) {
      await prisma.plantIssue.create({
        data: {
          plantId,
          kind: i.kind,
          name: i.name,
          description: i.description ?? null,
          management: i.management ?? null,
          source: 'Gardien starter dataset',
        },
      });
    }
  }

  // --- A demo garden, bed, season, planting & amendment -------------------
  const existingGarden = await prisma.garden.findFirst({
    where: { ownerId: admin.id, name: 'Backyard Garden' },
  });
  const garden =
    existingGarden ??
    (await prisma.garden.create({
      data: {
        ownerId: admin.id,
        name: 'Backyard Garden',
        description: 'Demo garden seeded for local development.',
        hardinessZone: '7b',
      },
    }));

  const existingBed = await prisma.bed.findFirst({ where: { gardenId: garden.id, name: 'Bed A' } });
  const bed =
    existingBed ??
    (await prisma.bed.create({
      data: {
        gardenId: garden.id,
        name: 'Bed A',
        bedType: 'raised_bed',
        lengthMm: 2400,
        widthMm: 1200,
        areaSqM: 2.88,
        soilType: 'Sandy loam',
      },
    }));

  const year = new Date().getFullYear();
  const existingSeason = await prisma.season.findFirst({
    where: { ownerId: admin.id, year, seasonType: 'spring' },
  });
  const season =
    existingSeason ??
    (await prisma.season.create({
      data: { ownerId: admin.id, name: `Spring ${year}`, seasonType: 'spring', year, isActive: true },
    }));

  const tomatoId = plantBySlug.get('tomato');
  if (tomatoId) {
    const existingPlanting = await prisma.plantingRecord.findFirst({
      where: { bedId: bed.id, plantId: tomatoId, seasonId: season.id },
    });
    if (!existingPlanting) {
      await prisma.plantingRecord.create({
        data: {
          bedId: bed.id,
          plantId: tomatoId,
          seasonId: season.id,
          quantity: 4,
          status: 'planned',
        },
      });
    }
  }

  const existingAmendment = await prisma.soilAmendment.findFirst({
    where: { bedId: bed.id, name: 'Compost' },
  });
  if (!existingAmendment) {
    await prisma.soilAmendment.create({
      data: { bedId: bed.id, seasonId: season.id, name: 'Compost', amount: 20, amountUnit: 'kg' },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
