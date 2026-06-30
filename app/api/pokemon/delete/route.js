import { NextResponse } from "next/server";
import { getToken } from 'next-auth/jwt';
import getDb from "@/app/db";

export async function POST(req) {
	try {
		const { _id } = await req.json();
		const db = await getDb();
		if (!db || !_id) {
			return NextResponse.json({ success: false }, { status: 400 });
		}

		const token = await getToken({ req });
		const users = db.collection('users');
		const collection = db.collection('pokedex');

		let deleteFilter = { _id };
		if (token) {
			const user = await users.findOne({ providerAccountId: token.sub });
			if (user) {
				deleteFilter.user_id = user._id;
				await collection.deleteOne(deleteFilter);
				if (user.pokedexEntries > 0) {
					await users.updateOne(
						{ _id: user._id },
						{ $set: { pokedexEntries: user.pokedexEntries - 1 } }
					);
				}
			}
		}

		return NextResponse.json({ success: true }, { status: 200 });
	} catch (e) {
		console.error("Delete error:", e);
		return NextResponse.json({ success: false, error: e.message }, { status: 500 });
	}
}
