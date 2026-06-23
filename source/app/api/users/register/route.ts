import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { runQuery, getQuery } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, company_name, ac } = body;

    // Validate required fields
    if (!username || !password || !company_name || !ac) {
      return NextResponse.json(
        { success: false, error: 'All required fields must be provided' },
        { status: 400 }
      );
    }

    // Check for duplicate username
    const existingUser = await getQuery(`SELECT id FROM users WHERE username = ?`, [username]);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Username already exists' },
        { status: 400 }
      );
    }

    // Resolve or Create Company
    let company_id;
    const existingCompany = await getQuery(`SELECT id FROM ks_companies WHERE LOWER(cnm) = LOWER(?)`, [company_name]);
    if (existingCompany) {
      company_id = existingCompany.id;
    } else {
      const insertResult = await runQuery(`INSERT INTO ks_companies (cnm, tdate) VALUES (?, CURRENT_TIMESTAMP)`, [company_name]);
      company_id = insertResult.id;
    }

    // Hash the password
    const pw = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await runQuery(
      `INSERT INTO users (username, pw, company_id, ac, User_for, added_date, actv)
       VALUES (?, ?, ?, ?, NULL, CURRENT_TIMESTAMP, 'y')`,
      [username, pw, company_id, ac]
    );

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      id: result.id,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}
