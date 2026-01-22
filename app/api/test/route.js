export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";

export async function GET(req) {
	try {
		const apiKey = process.env.GEMINI_API_KEY;
		if (!apiKey) {
			return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
		}

		console.log("Fetching available models...");
		const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
		const data = await response.json();

		return NextResponse.json({
			success: true,
			models: data
		}, { status: 200 });

	} catch (error) {
		console.error("Debug Error:", error);
		return NextResponse.json({
			success: false,
			error: error.message
		}, { status: 500 });
	}
}
