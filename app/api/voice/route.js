import { NextResponse } from "next/server";
import getDb from '@/app/db';
import { v2 as cloudinary } from 'cloudinary';

export const dynamic = 'force-dynamic';

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_NAME,
	api_key: process.env.CLOUDINARY_KEY,
	api_secret: process.env.CLOUDINARY_SECRET
});

export async function POST(req) {
	let { capture } = await req.json();
	try {
		const db = await getDb();
		const collection = db ? db.collection('pokedex') : null;

		if (!capture.description) {
			return NextResponse.json({ success: true, capture }, { status: 200 });
		}

		if (capture.voiceUrl) {
			return NextResponse.json({ success: true, capture }, { status: 200 });
		}

		const apiKey = process.env.ELEVENLABS_API_KEY;
		const voiceId = process.env.ELEVENLABS_VOICE_ID;

		if (!apiKey || !voiceId) {
			capture.useBrowserVoice = true;
			return NextResponse.json({ success: true, capture }, { status: 200 });
		}

		const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
			method: 'POST',
			headers: {
				'xi-api-key': apiKey,
				'Content-Type': 'application/json',
				'Accept': 'audio/mpeg'
			},
			body: JSON.stringify({
				text: capture.description,
				model_id: 'eleven_flash_v2_5',
				voice_settings: {
					stability: 0.75,
					similarity_boost: 0.75
				}
			})
		});

		if (!ttsResponse.ok) {
			console.error("ElevenLabs error:", ttsResponse.status);
			capture.useBrowserVoice = true;
			return NextResponse.json({ success: true, capture }, { status: 200 });
		}

		const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
		const base64Audio = audioBuffer.toString('base64');
		const dataUri = `data:audio/mpeg;base64,${base64Audio}`;

		const uploadResult = await cloudinary.uploader.upload(dataUri, {
			resource_type: 'video',
			folder: 'pokedex-voices',
			format: 'mp3'
		});

		capture.voiceUrl = uploadResult.secure_url;
		capture.voiceStatus = "complete_success";

		if (collection && capture._id) {
			await collection.updateOne(
				{ _id: capture._id },
				{ $set: { voiceUrl: capture.voiceUrl, voiceStatus: capture.voiceStatus } }
			);
		}

		return NextResponse.json({ success: true, capture }, { status: 200 });
	} catch (err) {
		console.error("Voice API error:", err);
		capture.useBrowserVoice = true;
		return NextResponse.json({ success: true, capture }, { status: 200 });
	}
}
