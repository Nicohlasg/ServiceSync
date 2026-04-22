const { createClient } = require('@supabase/supabase-js');

// Parse .env.local to get url and key
const fs = require('fs');
const envFile = fs.readFileSync('c:/Users/User/ServiceSyncSG/servicesync-v2/apps/web/.env.local', 'utf-8');
const lines = envFile.split('\n');
let url = '';
let key = '';
for (const line of lines) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function init() {
    console.log("Checking buckets...");
    
    // Create avatars bucket
    const { data: b1, error: err1 } = await supabase.storage.createBucket('avatars', {
        public: true,
        fileSizeLimit: 5242880, // 5MB limit
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    });
    
    if (err1) {
        console.error("Error creating avatars bucket:", err1.message);
    } else {
        console.log("Created avatars bucket successfully:", b1);
    }

    // Set bucket to public just in case
    const { error: err2 } = await supabase.storage.updateBucket('avatars', {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    });
    if (err2) {
        console.error("Error updating bucket:", err2.message);
    }
    
    console.log("Done!");
}

init();
