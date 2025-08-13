require('dotenv').config();

async function testFirebaseConfig() {
    console.log(' Testing Firebase Configuration...\n');

    // Check if environment variables are loaded
    console.log(' Environment Variables Check:');
    console.log('FIREBASE_ADMIN_PROJECT_ID:', process.env.FIREBASE_ADMIN_PROJECT_ID ? ' Set' : ' Missing');
    console.log('FIREBASE_ADMIN_PRIVATE_KEY_ID:', process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID ? ' Set' : ' Missing');
    console.log('FIREBASE_ADMIN_PRIVATE_KEY:', process.env.FIREBASE_ADMIN_PRIVATE_KEY ? ' Set' : ' Missing');
    console.log('FIREBASE_ADMIN_CLIENT_EMAIL:', process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? ' Set' : ' Missing');
    console.log('FIREBASE_ADMIN_CLIENT_ID:', process.env.FIREBASE_ADMIN_CLIENT_ID ? ' Set' : ' Missing');

    // Test Firebase Admin SDK
    try {
        const admin = require('firebase-admin');

        const serviceAccount = {
            type: "service_account",
            project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
            private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_ADMIN_CLIENT_EMAIL)}`
        };

        console.log('\n Firebase Admin SDK Test:');
        
        // Initialize Firebase Admin if not already initialized
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET
            });
            console.log(' Firebase Admin SDK initialized successfully');
        } else {
            console.log(' Firebase Admin SDK already initialized');
        }

        // Test basic functionality
        console.log(' Project ID:', admin.app().options.projectId);
        
        // Test auth (this might fail if you don't have users yet, but that's okay)
        try {
            await admin.auth().listUsers(1);
            console.log(' Firebase Auth connection successful');
        } catch (authError) {
            if (authError.code === 'auth/insufficient-permission') {
                console.log('  Auth test skipped (insufficient permissions - this is normal for new projects)');
            } else {
                console.log('  Auth test failed:', authError.message);
            }
        }

        // Test Firestore
        try {
            const db = admin.firestore();
            await db.collection('test').limit(1).get();
            console.log(' Firestore connection successful');
        } catch (firestoreError) {
            console.log('  Firestore test failed:', firestoreError.message);
        }

        console.log('\n Firebase configuration test completed!');

    } catch (error) {
        console.error('\n Firebase configuration error:');
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        
        if (error.message.includes('private_key')) {
            console.error('\n Hint: Check your FIREBASE_ADMIN_PRIVATE_KEY formatting in .env file');
            console.error('   - Make sure it\'s wrapped in quotes');
            console.error('   - Make sure it includes \\n for line breaks');
        }
    }
}

// Run the test
testFirebaseConfig();