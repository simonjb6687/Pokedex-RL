export const maxDuration = 60; // This function can run for a maximum of 5 seconds
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from 'uuid';
import db from '@/app/db'
import { UUID, ObjectId } from '@datastax/astra-db-ts';
import { v2 as cloudinary } from 'cloudinary';
import { getToken } from 'next-auth/jwt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_NAME,
	api_key: process.env.CLOUDINARY_KEY,
	api_secret: process.env.CLOUDINARY_SECRET
});

export async function POST(req) {
	console.time("Total Request Time");

	try {
		let { capture } = await req.json();

		// 1. Kick off Cloudinary Upload (Slowest part, don't await yet!)
		console.time("Image Upload Start");
		// Add catch block for Cloudinary specific failures
		const imageUploadPromise = cloudinary.uploader.upload(capture.image)
			.catch(err => {
				console.error("Cloudinary Upload Failed:", err);
				throw new Error("Image Upload Failed: Check Cloudinary Keys");
			});
		console.timeEnd("Image Upload Start");

		// 2. Perform Image Analysis
		console.time("Image Analysis");
		const imageDescription = await analysisImage(capture.image);
		console.timeEnd("Image Analysis");

		// Relaxed check
		if (imageDescription.includes("No object identified.")) {
			console.log("No object identified fallback triggered. Description:", imageDescription);
			console.timeEnd("Total Request Time");
			return NextResponse.json({
				success: true,
				entry: {
					object: "Unidentifiable Object",
					species: "Unknown",
					approximateWeight: "Unknown",
					approximateHeight: "Unknown",
					weight: 0,
					height: 0,
					hp: 0,
					attack: 0,
					defense: 0,
					speed: 0,
					type: "Unknown",
					description: `(v2.5-FLASH CHECK) ${imageDescription}`,
					voiceJobToken: "/no-object.wav",
				}
			}, { status: 200 });
		}

		console.log(`Starting Parallel AI Tasks...`);
		console.time("Parallel Tasks");
		
		// 3. Start all dependent AI tasks (Voice uses Manual Fetch)
		const aiTasksPromise = Promise.all([
			generateVoice(imageDescription),
			generateEntry(imageDescription),
			getEmbedding(imageDescription),
			getNoObject()
		]);

		// 4. Wait for EVERYTHING
		const [image, [voiceResult, entry, vector, no]] = await Promise.all([
			imageUploadPromise,
			aiTasksPromise
		]);
		console.timeEnd("Parallel Tasks");

		entry.$vector = vector;
		if (voiceResult) entry.inference_job_token = voiceResult;
		entry.voiceUrl = null; 
		entry.image = image ? image.secure_url : "";
		entry.no = no;

		console.time("DB Insert");
		let poke = await addToDatabase(req, entry);
		console.timeEnd("DB Insert");

		console.timeEnd("Total Request Time");
		return NextResponse.json({
			success: true,
			entry,
		}, { status: 200 });

	} catch (error) {
		console.error("API POST Error:", error);
		// Return JSON so frontend doesn't crash with "Application Error"
		return NextResponse.json({
			success: false,
			error: error.message || "Internal Server Error",
			entry: {
				object: "Error",
				description: "Something went wrong during generation. Check logs.",
				species: "Error", type: "Error", weight: 0, height: 0, hp: 0, attack: 0, defense: 0, speed: 0
			}
		}, { status: 500 });
	}
};

// ... (Rest of helper functions like generateEntry, getNoObject, addToDatabase remain the same) ...
// IMPORTANT: Ensure generateVoice uses the MANUAL FETCH method below:

const generateEntry = async (imageDescription) => {
	const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
	const prompt = `You are a Pokedex designed to output JSON. Given a description of an object, you should output a JSON object with the following fields: object, species, approximateWeight, approximateHeight, weight, height, hp, attack, defense, speed, and type. Humans for example would have base health of 100. Another example, if the object is a Golden Retriever, you should output: {object: 'Golden Retriever', species: 'Dog', approximateWeight: '10-20 kg', approximateHeight: '50-60 cm', weight: 15, height:55, hp: 50, attack: 40, defense: 40, speed: 19, type: 'normal'}. Another example for a  {object: 'Magpie', species: 'Bird', approximateWeight: '130 - 270 g', approximateHeight: '37-43 cm', weight: 0.2, height:40, hp: 25, attack: 20, defense: 10, speed: 32, type: 'Flying'} If you are given an object that is not a living creature, plant or lifeform, such as a coffee cup, output the same fields but with type: 'Inanimate'. If you are given a description of a person or human, output species: 'Human' and name: 'Person' and type: 'Normal'. If you are not sure what the attributes are for things like height or speed, it is okay to guess. Some examples, plants can have the type as Grass, with the species being Plant. Fish would have the type of Water with the species being Fish. Try to keep the types to the options avaiable in pokemon. Description: ${imageDescription}`;
	const result = await model.generateContent(prompt);
	const text = result.response.text();
	const cleanedText = text.replace(/```json|```/g, '').trim();
	let entry = JSON.parse(cleanedText);
	entry.description = imageDescription;
	entry._id = UUID.v4();
	return entry
}

const getNoObject = async () => {
	const collection = db.collection('pokedex');
	let poke = await collection.findOne({}, { sort: { no: -1 } });
	return poke.no + 1;
}

const addToDatabase = async (req, entry) => {
	const token = await getToken({ req });
	const users = db.collection('users');
	let user = {}
	if (token) {
		user = await users.findOne({ providerAccountId: token.sub });
	}
	let userObject = user ? { user_id: user._id, userName: user.name, userAvatar: user.avatar } : {};
	const collection = db.collection('pokedex');
	const ifAlreadyExists = await collection.findOne({ object: entry.object, user_id: user._id });
	if (ifAlreadyExists) return ifAlreadyExists;

	let poke = await collection.insertOne({ ...entry, ...userObject });
	if (user) {
		user.pokedexEntries = user.pokedexEntries ? user.pokedexEntries + 1 : 1;
		await users.updateOne({ _id: user._id }, { $set: { pokedexEntries: user.pokedexEntries } });
	}
	return poke
}

const generateVoice = async (description) => {
	console.log("--- generateVoice: START (Manual Native Fetch) ---");
	try {
		const loginResp = await fetch('https://api.fakeyou.com/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				username_or_email: process.env.FAKEYOU_EMAIL,
				password: process.env.FAKEYOU_PASSWORD
			})
		});
		if (!loginResp.ok) throw new Error(`Login status: ${loginResp.status}`);
		const cookieString = loginResp.headers.get('set-cookie');
		
		const inferenceResp = await fetch('https://api.fakeyou.com/tts/inference', {
			method: 'POST',
			headers: { 
				'Content-Type': 'application/json',
				'Cookie': cookieString || '' 
			},
			body: JSON.stringify({
				tts_model_token: 'weight_dh8zry5bgkfm0z6nv3anqa9y5',
				uuid_idempotency_token: uuidv4(),
				inference_text: description
			})
		});
		const inferenceData = await inferenceResp.json();
		if (!inferenceData.success) {
			console.error("Inference failure:", inferenceData);
			return null;
		}
		return inferenceData.inference_job_token;
	} catch (err) {
		console.error("--- generateVoice: FAILED ---", err.message);
		return null;
	}
}

const getEmbedding = async (text) => {
	const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
	const result = await model.embedContent(text);
	return result.embedding.values;
}

const analysisImage = async (image) => {
	const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
	const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
	const prompt = "You are a Pokedex. Identify the primary object, creature, or person in this image. If it is a Pokemon, identify it by name. If it is an inanimate object, describe it. If it is a person, describe them generally. Provide a brief, encyclopedia-style description (3-4 sentences). DO NOT say 'No object identified' unless the image is completely black or purely noise.";
	
	let imagePart;
	if (image.startsWith("data:")) {
		const [mimeType, base64Data] = image.split(";base64,");
		imagePart = { inlineData: { data: base64Data, mimeType: mimeType.replace("data:", "") } };
	} else { return "No object identified."; }

	try {
		const result = await model.generateContent([prompt, imagePart]);
		const text = result.response.text();
		if (!text || text.trim().length === 0) return "No object identified. (Empty Response)";
		return text;
	} catch (error) {
		console.error("Gemini analysis error:", error);
		return `No object identified. (Debug: ${error.message})`;
	}
}
