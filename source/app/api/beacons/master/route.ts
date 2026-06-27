import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Navigate up from source/app/api/beacons/master to the root directory
    // Assuming the root directory contains beacon_master.csv
    const filePath = path.join(process.cwd(), '..', 'beacon_master.csv');
    
    if (!fs.existsSync(filePath)) {
       // If running in a different environment, fallback to just process.cwd()
       const fallbackPath = path.join(process.cwd(), 'beacon_master.csv');
       if (!fs.existsSync(fallbackPath)) {
         return NextResponse.json({ error: 'Beacon master file not found', beacons: [] }, { status: 404 });
       }
       
       const content = fs.readFileSync(fallbackPath, 'utf8');
       return parseCSV(content);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return parseCSV(content);

  } catch (error) {
    console.error('Error reading beacon master file:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function parseCSV(content: string) {
  const lines = content.split('\n').filter(line => line.trim() !== '');
  if (lines.length <= 1) {
    return NextResponse.json({ beacons: [] });
  }

  const headers = lines[0].split(',');
  const beacons = lines.slice(1).map(line => {
    const values = line.split(',');
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = values[index]?.trim() || '';
    });
    return obj;
  });

  return NextResponse.json({ beacons });
}
