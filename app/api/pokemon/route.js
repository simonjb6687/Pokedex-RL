import { NextResponse } from "next/server";
import { getToken } from 'next-auth/jwt';
import getDb from "@/app/db";

export async function GET(req) {
	const db = await getDb();
	if (!db) {
		return NextResponse.json({ success: true, pokemon: [] }, { status: 200 });
	}
	const collection = db.collection('pokedex');
	const users = db.collection('users');
	const tk = await getToken({ req });
	if (tk) {
		const user = await users.findOne({ providerAccountId: tk.sub });
		if (user) {
			const pokemon = await collection.find({ user_id: user._id }).sort({ no: 1 }).limit(999).project({ embedding: 0 }).toArray();
			return NextResponse.json({ success: true, pokemon }, { status: 200 });
		}
	}
	return NextResponse.json({ success: true, pokemon: [] }, { status: 200 });
};
