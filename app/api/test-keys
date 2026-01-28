import { NextResponse } from "next/server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export async function GET(req) {
    const results = {
        gemini: { status: "pending" },
        fakeyou: { status: "pending" }
    };

    // 1. Test Gemini
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Try to list models (lightweight check) or just instantiate
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent("Test connection");
        const text = result.response.text();
        results.gemini = { status: "success", message: "Connected", responseStart: text.substring(0, 10) };
    } catch (e) {
        console.error(e);
        results.gemini = { status: "error", message: e.message };
    }

    // 2. Test FakeYou
    try {
        if (!process.env.FAKEYOU_EMAIL || !process.env.FAKEYOU_PASSWORD) {
            throw new Error("Missing EMAIL or PASSWORD env vars");
        }
        const FakeYou = require('fakeyou.js');
        const fy = new FakeYou.Client({
            usernameOrEmail: process.env.FAKEYOU_EMAIL,
            password: process.env.FAKEYOU_PASSWORD
        });
        await fy.start();
        // Try a lightweight operation like list voices or just confirm login didn't throw
        // fy.start() throws if login fails?
        results.fakeyou = { status: "success", message: "Login Successful" };
    } catch (e) {
        console.error(e);
        results.fakeyou = { status: "error", message: e.message };
    }

    return NextResponse.json(results, { status: 200 });
}
