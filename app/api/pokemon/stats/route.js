export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import db from "@/app/db";

export async function POST(req) {
  	const { _id, ...updates } = await req.json();
  	if (!_id) {
      		return NextResponse.json({ success: false, error: 'Missing _id' }, { status: 400 });
      	}

  	const allowed = ['captured', 'capturedCount', 'shiny', 'shinyCount'];
  	const filtered = {};
  	for (const key of allowed) {
      		if (updates[key] !== undefined) filtered[key] = updates[key];
      	}

  	const collection = db.collection('pokedex');
  	await collection.updateOne({ _id }, { $set: filtered });

  	return NextResponse.json({ success: true }, { status: 200 });
  }
