import { prisma } from '../src/lib/prisma.js';
import { getCloudFrontUrl } from '../src/services/aws.service.js';

async function test() {
    try {
        const inst = await prisma.institute.findFirst({
            include: { instituteImages: true }
        });

        if (!inst) {
            console.log("No institute found to test");
            return;
        }

        console.log("Found Institute ID:", inst.id);

        const updated = await prisma.institute.update({
            where: { id: inst.id },
            data: {
                headline: (inst.headline || "")
            },
            include: { instituteVerifications: true, instituteImages: true }
        });

        const images = (updated as any).instituteImages;
        console.log("Updated Images Relation Count:", images ? images.length : 'undefined');
        if (images && images.length > 0) {
            console.log("First Image Record:", images[0]);
        }
    } catch (e) {
        console.error("Test failed with error:", e);
    }
}

test().catch(console.error).finally(() => prisma.$disconnect());
