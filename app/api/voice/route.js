import { NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';
import getDb from '@/app/db';

export const dynamic = 'force-dynamic';

async function getFakeYouSession() {
	try {
		const loginResp = await fetch('https://api.fakeyou.com/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				username_or_email: process.env.FAKEYOU_EMAIL,
				password: process.env.FAKEYOU_PASSWORD
			})
		});
		if (!loginResp.ok) return null;
		return loginResp.headers.get('set-cookie');
	} catch (e) {
		console.error("FakeYou login failed:", e.message);
		return null;
	}
}

export async function POST(req) {
	let { capture } = await req.json();
	try {
		const db = await getDb();
		const collection = db ? db.collection('pokedex') : null;

		if (!capture.description) {
			return NextResponse.json({ success: true, capture }, { status: 200 });
		}

		const cookieString = await getFakeYouSession();

		if (!capture.inference_job_token) {
			capture.inference_job_token = await generateVoice(capture.description, cookieString);
			if (collection && capture._id) {
				await collection.updateOne(
					{ _id: capture._id },
					{ $set: { inference_job_token: capture.inference_job_token } }
				);
			}
		}

		if (!capture.voiceUrl) {
			let voice = await fetchVoice(capture.inference_job_token, cookieString);
			capture.voiceStatus = voice.status;
			if (voice.maybe_public_bucket_wav_audio_path) {
				capture.voiceUrl = `https://storage.googleapis.com/vocodes-public${voice.maybe_public_bucket_wav_audio_path}`;
			}
			if (collection && capture._id) {
				let updateFields = { voiceStatus: capture.voiceStatus };
				if (capture.voiceUrl) updateFields.voiceUrl = capture.voiceUrl;
				await collection.updateOne(
					{ _id: capture._id },
					{ $set: updateFields }
				);
			}
		}

		return NextResponse.json({ success: true, capture }, { status: 200 });
	} catch (err) {
		console.error("Voice API error:", err);
		return NextResponse.json({ success: true, capture }, { status: 200 });
	}
};

const generateVoice = async (description, cookieString) => {
	if (!cookieString) return null;
	try {
		const voice = await fetch('https://api.fakeyou.com/tts/inference', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': cookieString
			},
			body: JSON.stringify({
				tts_model_token: 'weight_dh8zry5bgkfm0z6nv3anqa9y5',
				uuid_idempotency_token: uuidv4(),
				inference_text: description,
			})
		}).then(res => res.json());
		return voice.inference_job_token;
	} catch (err) {
		console.error("generateVoice error:", err);
		return null;
	}
}

const fetchVoice = async (inference_job_token, cookieString) => {
	if (!inference_job_token) return { status: "pending" };
	try {
		const headers = { 'Content-Type': 'application/json' };
		if (cookieString) headers['Cookie'] = cookieString;
		const voice = await fetch(`https://api.fakeyou.com/tts/job/${inference_job_token}`, {
			method: 'GET',
			headers,
		}).then(res => res.json());
				console.log("FakeYou job raw:", JSON.stringify(voice).substring(0, 500));
		return voice.state;
	} catch (err) {
		console.error("fetchVoice error:", err);
		return { status: "error" };
	}
}
