import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import getDb from "@/app/db";

const authOptions = {
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID ?? "",
			clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
			authorization: {
				params: {
				  response_type: "code",
				  prompt: "consent",
				  scope: 'openid email profile'
				}
			  }
		})
	],

	callbacks: {
		async signIn({ user, account }) {
			const { email, name, image, id, provider } = user;
			try {
				const db = await getDb();
				if (!db) return true;
				const collection = db.collection('users');
				const findUser = await collection.findOne({ providerAccountId: id });
				if (findUser) {
					return true;
				}
				await collection.insertOne({
					email,
					name,
					avatar: image,
					providerAccountId: id,
					provider,
					lastUpdated: Date.now(),
					pokedexEntries: 0,
				});
			} catch (e) {
				console.error("signIn DB error:", e.message);
			}
			return true;
		},
		async jwt({ token, account }) {
			if (account) {
			  token.accessToken = account.access_token
			}
			return token
		},
		async session({ session, token, user }) {
			session.accessToken = token.accessToken
			return session
		},
	},
}
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST, authOptions }
