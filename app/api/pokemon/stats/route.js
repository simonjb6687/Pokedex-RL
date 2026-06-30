export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import db from "@/app/db";

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

    const database = await db();
    const collection = database.collection("pokedex");
    await collection.updateOne({ _id }, { $set: filtered });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
