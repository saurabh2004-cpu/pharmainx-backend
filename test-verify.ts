import { prisma } from './src/lib/prisma.js';

async function test() {
    try {
        const user = await prisma.user.findFirst({ where: { verified: false } });
        if (!user) {
            console.log("No unverified user found");
            return;
        }

        console.log("Found user:", user.id);
        const id = user.id;

        // Ensure a pending verification exists
        let pending = await prisma.userVerifications.findFirst({ where: { userId: id } });
        if (!pending) {
            pending = await prisma.userVerifications.create({
                data: {
                    userId: id,
                    userRole: 'DOCTOR',
                    status: 'PENDING',
                    firstName: user.firstName,
                    lastName: user.lastName,
                    dob: new Date(),
                    governMentId: 'N/A',
                    authorizeToVerify: true,
                    email: user.email,
                    phone: '1234567890',
                    country: 'India',
                    city: 'Delhi',
                    professionalTitle: 'Dr',
                    primarySpecialty: 'General',
                    licenseNumber: '12345',
                    licenseExpiryDate: new Date(),
                    degree: 'MBBS',
                    university: 'AIIMS',
                    yearOfGraduation: new Date(),
                    degreeCertificate: 'N/A'
                }
            });
        }

        console.log("Found/Created pending verification:", pending.id);

        const status = 'APPROVED';
        const isVerified = true;

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { verified: isVerified },
            include: { userImages: true }
        });
        console.log("Update user success:", updatedUser.id);

        const pendingVerification = await prisma.userVerifications.findFirst({
            where: { userId: id, status: 'PENDING' },
            orderBy: { created_at: 'desc' }
        });

        if (pendingVerification) {
            await prisma.userVerifications.update({
                where: { id: pendingVerification.id },
                // @ts-ignore
                data: { status: status }
            });
            console.log("Update userVerifications success");
        } else {
            console.log("No pending Verification found during exact query");
        }

    } catch (e) {
        console.error("ERROR CAUGHT:");
        console.error(e);
    }
}
test().then(() => process.exit(0));
