import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

let clientPromise;

if (uri) {
    if (process.env.NODE_ENV === 'development') {
          if (!global._mongoClientPromise) {
                  global._mongoClientPromise = new MongoClient(uri).connect();
          }
          clientPromise = global._mongoClientPromise;
    } else {
          clientPromise = new MongoClient(uri).connect();
    }
}

export default async function getDb() {
    if (!clientPromise) return null;
    const client = await clientPromise;
    return client.db('pokedex_rl');
}
