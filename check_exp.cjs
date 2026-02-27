const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
    const jobs = await prisma.job.findMany({
        select: { experienceLevel: true },
        take: 10
    });
    console.log(JSON.stringify(jobs, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
