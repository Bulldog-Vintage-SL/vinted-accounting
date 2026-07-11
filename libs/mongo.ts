import { MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-unused-vars
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const uri = process.env.MONGODB_URI;
const options = {};

let clientPromise: Promise<MongoClient> | undefined;

if (!uri) {
  console.warn(
    "MONGODB_URI is missing — OAuth sign-in will fail when a database adapter is required."
  );
} else {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
}

export default clientPromise;
