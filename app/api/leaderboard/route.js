import { NextResponse } from "next/server";
import getDb from "@/app/db";

export async function POST(req) {
	const db = await getDb();
	if (!db) {
		return NextResponse.json({ success: true, leaderboard: [] }, { status: 200 });
	}

	const users = db.collection('users');

	const leaderboard = await users
		.find({})
		.sort({ pokedexEntries: -1 })
		.limit(999)
		.project({ name: 1, avatar: 1, pokedexEntries: 1 })
		.toArray();

	return NextResponse.json({ success: true, leaderboard }, { status: 200 });
};
