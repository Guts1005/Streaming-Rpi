import { allQuery } from './lib/db';
async function main() {
  const sites = await allQuery('SELECT * FROM ks_sites');
  console.log('SITES:', sites);
  const devices = await allQuery('SELECT * FROM ks_devices');
  console.log('DEVICES:', devices);
  const beacons = await allQuery('SELECT * FROM ks_beacons_master');
  console.log('BEACONS:', beacons);
}
main();
