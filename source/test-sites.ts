import { allQuery } from './lib/db';

async function main() {
  try {
    const sites = await allQuery('SELECT id, site_name, company_id FROM ks_sites');
    console.log("Sites:", sites);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
