"use client";
import { computed, makeAutoObservable, configure } from 'mobx'
import { useRouter } from 'next/navigation'
import Resizer from "react-image-file-resizer";
import { getSession } from "next-auth/react"

configure({ enforceActions: "never", })

const CAPTURE_SCHEMA = {
	"object": "",
	"image": "",
	"species": "",
	"approximateWeight": "",
	"approximateHeight": "",
	"weight": 0,
	"height": 0,
	"hp": 0,
	"attack": 0,
	"defense": 0,
	"speed": 0,
	"type": "",
	"description": "",
	voiceJobToken: "",
	voicePath: "",
	voiceStatus: "",
	voiceUrl: "",
}

class appStore {
	store;
	router = useRouter()
	constructor(store){
		makeAutoObservable(this);
		this.store = store
		this.init();
	}

	leaderboard = []

	async init(){
		try {
			const session = await getSession()
			if(!session){
				return false
			}
			this.profile = {
				name: session.user.name,
				email: session.user.email,
				avatar: session.user.image
			}
			this.getUser()
			this.getLeaderboard();
		} catch (error) {
			console.error(error);
		}
	}

	profile = {
		name: "Demo",
		email: "",
		avatar: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
	}

	async getUser(){
		const response = await fetch('/api/user', {
			cache: 'no-store'
		});
		const { user } = await response.json();
		console.log(`getUser`,user)
		if (user) {
			this.profile = { ...user }	
		}
		this.getPokemon()
	}


	pokemon = []
	
	keyword = ""
	get filteredPokemon(){
		return this.pokemon.filter(poke => {
			return poke.object.toLowerCase().includes(this.keyword.toLowerCase()) || poke.type.toLowerCase().includes(this.keyword.toLowerCase())
		})
	}

	capture = { ...CAPTURE_SCHEMA }

	picture = {
		buttonPressed: false,
		loadingContent: false,
	}

	getPokemon = async () => {
		const response = await fetch("/api/pokemon", {
			method: "GET",
			headers: {
				'Content-Type': 'application/json'
			},
		});
		const data = await response.json();
		this.pokemon = data.pokemon
	}

	getLeaderboard = async () => {
		this.leaderboardRefresh = true
		this.leaderboard = []
		const response = await fetch("/api/leaderboard", {
			method: "POST",
			headers: {
				'Content-Type': 'application/json'
			},
		});
		const data = await response.json();
		this.leaderboard = [ ...data.leaderboard ]
		this.leaderboardRefresh = false
	}

	deletePokemon = async () => {
		const _id = this.capture._id
		const response = await fetch("/api/pokemon/delete", {
			method: "POST",
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ 
				_id
			}),
		});
		const data = await response.json();
		this.capture = { ...CAPTURE_SCHEMA }
		await this.getPokemon();
		this.router.push('/pokedex')
	}

	handleCaptureImage = async (file) => {
		this.capture = { ...CAPTURE_SCHEMA }
		if(file.target){
			file = file.target.files[0];
			file = await new Promise(resolve => {
				Resizer.imageFileResizer(file, 512, 512, 'JPEG', 100, 0,
				uri => {
				  resolve(uri);
				}, 'base64' );
			})
		}
		this.capture.image = file;
		this.analysisCapture()
	}

	analysisCapture = async () => {
		const response = await fetch("/api", {
			method: "POST",
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ 
				capture: this.capture
			 }),
		});
		const data = await response.json();
		this.capture = { 
			...data.entry, 
			image: this.capture.image 
		}
		if(this.capture.description == "No object identified." || this.capture.description == "No object detected."){
		} else {
			this.pokemon.push(this.capture)
		}
		this.router.push('/pokedex/preview')
		store.picture.buttonPressed = false
		store.picture.loadingContent = false
	} 

	pollingVoice;
	voicePollCount = 0;
	useBrowserVoice = false;

	fetchVoice = async () => {
		if(!store.capture.description){
			return false
		}
		if(store.capture.voiceUrl){
			return false
		}
		this.voicePollCount++;
		if(this.voicePollCount > 6){
			this.useBrowserVoice = true;
			return false;
		}
		const bodyData = {
			capture: {
				_id: store.capture._id,
				inference_job_token: store.capture.inference_job_token,
				description: store.capture.description,
				voiceUrl: store.capture.voiceUrl,
			}
		}
		const response = await fetch("/api/voice", {
			method: "POST",
			headers: {
				'Content-Type': 'application/json'
			},
			cache: 'no-store',
			body: JSON.stringify(bodyData),
		});
		const data = await response.json();
		this.capture = { 
			...this.capture, 
			...data.capture 
		}
		const index = this.pokemon.findIndex(poke => poke._id && this.capture._id && poke._id.$uuid == this.capture._id.$uuid)
		if(index >= 0) this.pokemon[index] = { ...this.capture }
		if(this.capture.voiceStatus != "complete_success"){
			this.pollingVoice = setTimeout(this.fetchVoice, 5000);
		}
	}

	viewPoke = async (poke) => {
		this.capture = { ...poke }
		this.voicePollCount = 0;
		this.useBrowserVoice = false;
		this.router.push('/pokedex/preview/');
	}
	
}

export default appStore
