import { prisma } from './lib/prisma.js';

async function main() {
    const authId = '9151cb1e-eb06-4e7c-94ec-7c994681b369';
    console.log('Checking Institute:', authId);

    try {
        const institute = await prisma.institute.findUnique({
            where: { id: authId },
            include: {
                instituteCreditsWallets: true,
            }
        });
        console.log('Institute found:', !!institute);
        if (institute) {
            console.log('Credits Wallets:', JSON.stringify(institute.instituteCreditsWallets, null, 2));
        } else {
            console.log('Institute NOT FOUND');
        }

        const creditsConfig = await prisma.creditsWallet.findFirst();
        console.log('Credits Config:', JSON.stringify(creditsConfig, null, 2));

        if (institute && institute.instituteCreditsWallets.length > 0 && creditsConfig) {
            const wallet = institute.instituteCreditsWallets[0];
            console.log(`Wallet credits: ${wallet.credits}, Required: ${creditsConfig.newJobCreditsPrice}`);
            if (wallet.credits < creditsConfig.newJobCreditsPrice) {
                console.log('RESULT: INSUFFICIENT CREDITS');
            } else {
                console.log('RESULT: SUFFICIENT CREDITS');
            }
        } else {
            if (!institute) console.log('RESULT: INSTITUTE NOT FOUND');
            else if (institute.instituteCreditsWallets.length === 0) console.log('RESULT: NO WALLET FOUND');
            else if (!creditsConfig) console.log('RESULT: NO CREDITS CONFIG FOUND');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch(console.error);
