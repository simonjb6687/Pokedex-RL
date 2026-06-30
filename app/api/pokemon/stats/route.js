export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import db from "@/app/db";

export async function GET() {
  try {
    const type = typeof db;
    const keys = db ? Object.keys(db).slice(0, 10) : [];
    const hasColl = db && typeof db.collection === "function";
    return NextResponse.json({ type, keys, hasColl, dbStr: String(db) });
  } catch (e) {
    return NextResponse.json({ error: e.message });
  }
}

export async function POST(req) {
  try {
    const { _id, ...updates } = await req.json();
    if (!_id) {
      return NextResponse.json({ success: false, error: "Missing _id" }, { status: 400 });
    }

    const allowed = ["captured", "capturedCount", "shiny", "shinyCount"];
    const filtered = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) filtered[key] = updates[key];
    }

    const collection = db.collection("pokedex");
    await collection.updateOne({ _id }, { $set: filtered });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message, stack: e.stack }, { status: 500 });
  }
}
