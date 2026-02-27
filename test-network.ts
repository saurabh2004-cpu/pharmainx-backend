async function test() {
    try {
        console.log("Pinging network...");
        const response = await fetch('http://localhost:3000/api/user/verify/2819a5e2-ccbc-447d-8e93-8611c4d090b6', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: "APPROVED"
            })
        });

        const data = await response.json().catch(() => null);
        console.log("Response:", response.status, data);
    } catch (e) {
        console.error("Connection Error:", e.message);
    }
}
test();
