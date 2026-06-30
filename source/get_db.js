const fs = require('fs');

const envFile = fs.readFileSync('.env.production', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL="?([^"\n]+)"?/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)"?/);

if (!urlMatch || !keyMatch) {
    console.log("Missing URL or Key");
    process.exit(1);
}

const url = urlMatch[1];
const key = keyMatch[1];

fetch(`${url}/rest/v1/ks_devices?select=id,device_name,api_base_url`, {
    headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
    }
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(err => console.error(err));
