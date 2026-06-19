// Node verify auth script using native http
// If native fetch is not available, I'll need to use http/https module or require('http').
// To be safe and dependency-free, I'll use the 'http' module.

const http = require('http');

function postRequest(path, data) {
    return new Promise((resolve, reject) => {
        const dataString = JSON.stringify(data);
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': dataString.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, body: body });
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(dataString);
        req.end();
    });
}

async function testRegistration() {
    const randomNum = Math.floor(Math.random() * 10000);
    const user = {
        name: `Test User ${randomNum}`,
        email: `test_verify_${randomNum}@example.com`,
        password: 'Password1',
        phone: '5551234567'
    };

    console.log('Attempting to register user:', user.email);

    try {
        const response = await postRequest('/api/auth/register', user);
        console.log('Response Status:', response.status);
        console.log('Response Body:', JSON.stringify(response.body, null, 2));

        if (response.status === 201 && response.body.success) {
            console.log('SUCCESS: Registration verified working.');
        } else {
            console.log('FAILURE: Registration failed.');
        }
    } catch (error) {
        console.error('ERROR during request:', error);
    }
}

testRegistration();
